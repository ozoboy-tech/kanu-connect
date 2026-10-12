import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { registerEmail } from "@/server/auth/accounts";
import { reviewContent } from "@/server/moderation/moderation-repository";
import { createProject, deleteProject } from "@/server/projects/project-repository";
import {
  decideCollaboration, listCollaborations, requestCollaboration, withdrawCollaboration,
} from "@/server/projects/collaboration-repository";
import { reportContent } from "@/server/reports/report-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("protège les demandes, leurs décisions et les envois simultanés", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test", password,
    database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z",
    multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const parallel = await pool.getConnection();
  const previousModerators = process.env.KANU_MODERATOR_IDS;
  const suffix = randomBytes(8).toString("hex");
  const members: { id: number; publicId: string }[] = [];
  try {
    for (const label of ["owner", "alice", "bob"]) {
      const handle = `co_${label}_${suffix}`;
      await registerEmail(connection, {
        email: `${handle}@example.test`, password: "MotDePasse!123456",
        legalName: `Test ${label}`, handle,
      });
      const [rows] = await connection.execute<(
        RowDataPacket & { id: number; publicId: string }
      )[]>(
        `SELECT m.id, m.public_id AS publicId FROM members m
         JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`, [handle],
      );
      members.push(rows[0]);
    }
    const [owner, alice, bob] = members.map((member) => member.publicId);
    const input = {
      title: "Projet à construire", summary: "Recherche de contributions",
      description: "Présentation", status: "building" as const,
      technologies: ["TypeScript"], repositoryUrl: null, demoUrl: null,
    };
    const project = await createProject(connection, owner, input);
    const another = await createProject(connection, owner, input);
    const withdrawal = await createProject(connection, owner, input);
    expect(await withdrawCollaboration(connection, withdrawal.id, owner)).toBe("forbidden");
    expect(await withdrawCollaboration(connection, withdrawal.id, bob)).toBe("not_found");
    expect(await requestCollaboration(connection, withdrawal.id, alice, "Demande à retirer")).toBe("ok");
    expect(await withdrawCollaboration(connection, withdrawal.id, alice)).toBe("ok");
    expect(await withdrawCollaboration(connection, withdrawal.id, alice)).toBe("ok");
    expect((await listCollaborations(connection, withdrawal.id, alice))?.requests[0].status).toBe("withdrawn");
    expect(await decideCollaboration(connection, withdrawal.id, owner, alice, "accepted")).toBe("conflict");
    expect(await requestCollaboration(connection, withdrawal.id, alice, "Nouvelle demande")).toBe("duplicate");
    expect(await requestCollaboration(connection, withdrawal.id, bob, "Demande simultanée")).toBe("ok");
    const withdrawalRace = await Promise.all([
      withdrawCollaboration(connection, withdrawal.id, bob),
      decideCollaboration(parallel, withdrawal.id, owner, bob, "accepted"),
    ]);
    expect(withdrawalRace.sort()).toEqual(["conflict", "ok"]);
    expect(["withdrawn", "accepted"]).toContain((await listCollaborations(connection, withdrawal.id, bob))?.requests[0].status);
    expect(await requestCollaboration(connection, project.id, owner, "Moi"))
      .toBe("forbidden");

    const simultaneous = await Promise.all([
      requestCollaboration(connection, project.id, alice, "Je peux aider."),
      requestCollaboration(parallel, project.id, alice, "Je peux aider."),
    ]);
    expect(simultaneous.sort()).toEqual(["duplicate", "ok"]);
    expect(await requestCollaboration(connection, project.id, bob, "Je participe."))
      .toBe("ok");
    const own = await listCollaborations(connection, project.id, alice);
    expect(own?.requests).toHaveLength(1);
    expect(own?.requests[0]).toMatchObject({ memberId: alice, status: "pending" });
    expect(own?.requests[0]).not.toHaveProperty("legalName");
    expect(own?.requests[0]).not.toHaveProperty("email");
    expect((await listCollaborations(connection, project.id, owner))?.requests)
      .toHaveLength(2);
    expect((await listCollaborations(connection, another.id, owner))?.requests)
      .toHaveLength(0);
    expect(await listCollaborations(connection, project.id, "absent")).toBeNull();
    expect(await decideCollaboration(connection, project.id, bob, alice, "accepted"))
      .toBe("forbidden");
    expect(await decideCollaboration(connection, another.id, owner, alice, "accepted"))
      .toBe("not_found");
    expect(await decideCollaboration(connection, project.id, owner, alice, "accepted"))
      .toBe("ok");
    expect(await decideCollaboration(connection, project.id, owner, alice, "rejected"))
      .toBe("conflict");
    expect(await decideCollaboration(connection, project.id, owner, bob, "rejected"))
      .toBe("ok");
    expect(await requestCollaboration(connection, project.id, bob, "Nouvelle demande"))
      .toBe("duplicate");
    expect((await listCollaborations(connection, project.id, alice))?.requests[0].status)
      .toBe("accepted");
    expect(await withdrawCollaboration(connection, project.id, alice)).toBe("conflict");
    expect((await listCollaborations(connection, project.id, bob))?.requests[0].status)
      .toBe("rejected");

    process.env.KANU_MODERATOR_IDS = owner;
    await reportContent(connection, "project", project.id, bob, "spam");
    expect(await reviewContent(connection, "project", project.id, owner, "hide", "Test"))
      .toBe("ok");
    expect(await listCollaborations(connection, project.id, owner)).toBeNull();
    expect(await withdrawCollaboration(connection, project.id, alice)).toBe("not_found");
    expect(await requestCollaboration(connection, project.id, alice, "Test"))
      .toBe("not_found");
    expect(await decideCollaboration(connection, project.id, owner, bob, "accepted"))
      .toBe("not_found");
    await reviewContent(connection, "project", project.id, owner, "restore", "Test");
    expect((await listCollaborations(connection, project.id, alice))?.requests[0].status)
      .toBe("accepted");
    await deleteProject(connection, project.id, owner);
    expect(await listCollaborations(connection, project.id, owner)).toBeNull();
    expect(await requestCollaboration(connection, project.id, alice, "Test"))
      .toBe("not_found");
  } finally {
    try {
      for (const member of members) {
        await connection.execute("DELETE FROM member_projects WHERE member_id = ?", [member.id]);
      }
      for (const member of members) {
        for (const table of [
          "member_auth_tokens", "member_sessions", "member_oauth_link_intents",
          "member_oauth_accounts", "member_email_credentials", "member_profiles",
          "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [member.id]);
        await connection.execute("DELETE FROM members WHERE id = ?", [member.id]);
      }
    } finally {
      if (previousModerators === undefined) delete process.env.KANU_MODERATOR_IDS;
      else process.env.KANU_MODERATOR_IDS = previousModerators;
      parallel.release(); connection.release(); await pool.end();
    }
  }
}, 90_000);
