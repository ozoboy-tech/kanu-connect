import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import {
  createProject, deleteProject, getProject, listMemberProjects,
  listProjects, updateProject,
} from "@/server/projects/project-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("présente un projet, réserve sa gestion à l'auteur et masque sa suppression", async () => {
  const appPassword = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!appPassword || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test",
    password: appPassword, database: "kanuconnecttest", charset: "utf8mb4",
    timezone: "Z", multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const suffix = randomBytes(8).toString("hex");
  const handle = `pj_${suffix}`;
  let memberId: number | undefined;
  let projectId: number | undefined;
  try {
    await registerEmail(connection, {
      email: `project_${suffix}@example.test`,
      password: "MotDePasse!123456", legalName: "Awa Test", handle,
    });
    const [members] = await connection.execute<(
      RowDataPacket & { id: number; publicId: string }
    )[]>(
      `SELECT m.id, m.public_id AS publicId FROM members m
       JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`, [handle],
    );
    memberId = members[0].id;
    const authorId = members[0].publicId;
    const input = {
      title: "Kanu Test", summary: "Une démonstration de projet",
      description: "Présentation détaillée", status: "building" as const,
      technologies: ["Next.js", "MySQL"],
      repositoryUrl: "https://github.com/example/project", demoUrl: null,
    };
    const project = await createProject(connection, authorId, input);
    const [projects] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM member_projects WHERE public_id = ?", [project.id],
    );
    projectId = projects[0].id;
    expect(project).toMatchObject({
      authorHandle: handle, technologies: ["Next.js", "MySQL"], deleted: false,
    });
    expect((await listProjects(connection)).some((item) => item.id === project.id)).toBe(true);
    expect((await listMemberProjects(connection, handle)).map((item) => item.id))
      .toContain(project.id);
    expect(await updateProject(connection, project.id, "autre", input)).toBe("forbidden");
    expect(await updateProject(connection, project.id, authorId, {
      ...input, status: "live", demoUrl: "https://example.org/demo",
    })).toBe("ok");
    expect(await getProject(connection, project.id)).toMatchObject({
      status: "live", demoUrl: "https://example.org/demo",
    });
    expect(await deleteProject(connection, project.id, "autre")).toBe("forbidden");
    expect(await deleteProject(connection, project.id, authorId)).toBe("ok");
    expect(await getProject(connection, project.id)).toMatchObject({
      title: "Projet supprimé", authorHandle: null, technologies: [], deleted: true,
    });
    expect((await listProjects(connection)).some((item) => item.id === project.id)).toBe(false);
    expect(await listMemberProjects(connection, handle)).toEqual([]);
    expect(await updateProject(connection, project.id, authorId, input)).toBe("not_found");
  } finally {
    try {
      if (projectId) {
        await connection.execute("DELETE FROM member_projects WHERE id = ?", [projectId]);
      }
      if (memberId) {
        for (const table of [
          "member_auth_tokens", "member_sessions", "member_oauth_link_intents",
          "member_oauth_accounts", "member_email_credentials", "member_profiles",
          "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [memberId]);
        await connection.execute("DELETE FROM members WHERE id = ?", [memberId]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);
