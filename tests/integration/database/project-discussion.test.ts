import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { registerEmail } from "@/server/auth/accounts";
import { reviewContent } from "@/server/moderation/moderation-repository";
import { decideCollaboration, requestCollaboration } from "@/server/projects/collaboration-repository";
import { listDiscussionMessages, sendDiscussionMessage } from "@/server/projects/discussion-repository";
import { createProject, deleteProject } from "@/server/projects/project-repository";
import { reportContent } from "@/server/reports/report-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("réserve la discussion à l'équipe et conserve un historique paginé", async () => {
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
    for (const label of ["owner", "alice", "bob", "other"]) {
      const handle = `di_${label}_${suffix}`;
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
    const [owner, alice, bob, other] = members.map((member) => member.publicId);
    const input = {
      title: "Discussion équipe", summary: "Préparer le projet ensemble",
      description: "Présentation", status: "building" as const,
      technologies: ["TypeScript"], repositoryUrl: null, demoUrl: null,
    };
    const project = await createProject(connection, owner, input);
    const another = await createProject(connection, owner, input);
    const list = (viewer: string, before: string | null = null) =>
      listDiscussionMessages(connection, project.id, viewer, before);
    const send = (viewer: string, message: unknown) =>
      sendDiscussionMessage(connection, project.id, viewer, message);
    const denied = async (viewer: string) => {
      expect(await list(viewer)).toBeNull();
      expect(await send(viewer, "Interdit")).toBe("not_found");
    };

    expect(await list(owner)).toEqual({ messages: [], nextCursor: null });
    await denied("absent");
    await denied(other);
    await requestCollaboration(connection, project.id, alice, "Je participe.");
    await requestCollaboration(connection, project.id, bob, "Moi aussi.");
    await denied(alice);
    await denied(bob);
    await decideCollaboration(connection, project.id, owner, bob, "rejected");
    await denied(bob);
    expect(await send(owner, "  Premier message  ")).toBe("ok");
    await decideCollaboration(connection, project.id, owner, alice, "accepted");
    expect((await list(alice))?.messages[0].body).toBe("Premier message");
    expect(await listDiscussionMessages(connection, another.id, alice)).toBeNull();
    expect(await sendDiscussionMessage(connection, another.id, alice, "Interdit"))
      .toBe("not_found");
    await expect(send(owner, " \n ")).rejects.toThrow(TypeError);
    await expect(send(owner, "x".repeat(2001))).rejects.toThrow(TypeError);

    for (let index = 1; index <= 20; index++) {
      expect(await send(alice, `Message ${index}`)).toBe("ok");
    }
    expect(await Promise.all([
      sendDiscussionMessage(connection, project.id, owner, "Message parallèle A"),
      sendDiscussionMessage(parallel, project.id, alice, "Message parallèle B"),
    ])).toEqual(["ok", "ok"]);

    const latest = (await list(alice))!;
    expect(latest.messages).toHaveLength(20);
    expect(latest.nextCursor).toBe(latest.messages[19].id);
    const older = (await list(alice, latest.nextCursor))!;
    expect(older.messages).toHaveLength(3);
    expect(older.nextCursor).toBeNull();
    const all = [...latest.messages, ...older.messages];
    expect(new Set(all.map((message) => message.id)).size).toBe(23);
    for (let index = 1; index < all.length; index++) {
      expect(BigInt(all[index - 1].id) > BigInt(all[index].id)).toBe(true);
    }
    expect(all[22].body).toBe("Premier message");
    expect(all[22].authorId).toBe(owner);
    expect(all[22].authorHandle).toBe(`di_owner_${suffix}`);
    expect(Object.keys(all[0]).sort()).toEqual([
      "authorHandle", "authorId", "body", "createdAt", "id",
    ]);
    expect(Number.isNaN(Date.parse(all[0].createdAt))).toBe(false);
    expect((await listDiscussionMessages(connection, another.id, owner))?.messages)
      .toHaveLength(0);
    await denied(other);
    await expect(list(owner, "0 OR 1=1")).rejects.toThrow(TypeError);

    process.env.KANU_MODERATOR_IDS = other;
    await denied(other);
    await reportContent(connection, "project", project.id, bob, "spam");
    expect(await reviewContent(connection, "project", project.id, other, "hide", "Test"))
      .toBe("ok");
    await denied(owner);
    await denied(alice);
    expect(await reviewContent(connection, "project", project.id, other, "restore", "Test"))
      .toBe("ok");
    expect((await list(alice))?.messages).toHaveLength(20);
    await deleteProject(connection, project.id, owner);
    await denied(owner);
    await denied(alice);
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
