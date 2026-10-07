import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import { createComment } from "@/server/comments/comment-repository";
import { setFollow } from "@/server/members/follow-repository";
import { createPost } from "@/server/posts/post-repository";
import { createProject } from "@/server/projects/project-repository";
import { awardActivity, getReputation, listLeaderboard } from
  "@/server/reputation/reputation-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("attribue une seule fois les points, plafonne la journée et affiche les badges", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test", password,
    database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z",
    multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const suffix = randomBytes(8).toString("hex");
  const members: { id: number; publicId: string; handle: string }[] = [];
  try {
    for (const label of ["author", "peer"]) {
      const handle = `rep_${label}_${suffix}`;
      await registerEmail(connection, {
        email: `rep_${label}_${suffix}@example.test`, password: "MotDePasse!123456",
        legalName: `Test ${label}`, handle,
      });
      const [rows] = await connection.execute<(
        RowDataPacket & { id: number; publicId: string }
      )[]>(
        `SELECT m.id, m.public_id AS publicId FROM members m
         JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`, [handle],
      );
      members.push({ ...rows[0], handle });
    }
    const [author, peer] = members;
    const post = await createPost(connection, author.publicId, {
      kind: "question", space: "questions", title: "Réputation de test",
      body: "Question pour vérifier les points", code: null,
      codeLanguage: null, keywords: [],
    });
    await createComment(connection, post.id, author.publicId, {
      parentId: null, body: "Ma réponse de test",
    });
    expect(await setFollow(connection, peer.handle, author.publicId, true)).toBe("ok");
    expect(await setFollow(connection, peer.handle, author.publicId, false)).toBe("ok");
    expect(await setFollow(connection, peer.handle, author.publicId, true)).toBe("ok");
    const projectIds: number[] = [];
    for (let index = 0; index < 6; index++) {
      const project = await createProject(connection, author.publicId, {
        title: `Projet ${index}`, summary: "Projet de test",
        description: "Description de test", status: "building",
        technologies: ["TypeScript"], repositoryUrl: null, demoUrl: null,
      });
      const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM member_projects WHERE public_id = ?", [project.id],
      );
      projectIds.push(rows[0].id);
    }
    expect(await awardActivity(connection, author.id, "project", projectIds[0])).toBe(0);
    expect(await getReputation(connection, author.handle)).toEqual({
      points: 50, badges: ["Premiers pas", "Contributeur"],
    });
    expect(await getReputation(connection, peer.handle)).toEqual({ points: 0, badges: [] });
    const [days] = await connection.execute<(RowDataPacket & { points: number })[]>(
      "SELECT points FROM member_reputation_days WHERE member_id = ? AND day_utc = UTC_DATE()",
      [author.id],
    );
    expect(days[0].points).toBe(50);
    const [events] = await connection.execute<(RowDataPacket & { points: number })[]>(
      `SELECT points FROM member_reputation_events
       WHERE member_id = ? AND action = 'project' ORDER BY source_id`, [author.id],
    );
    expect(events.map((row) => row.points)).toEqual([8, 8, 8, 8, 8, 2]);
    expect((await listLeaderboard(connection, "all"))[0]).toEqual({
      handle: author.handle, points: 50,
    });
    expect((await listLeaderboard(connection, "week"))[0]).toEqual({
      handle: author.handle, points: 50,
    });
  } finally {
    try {
      for (const member of members) {
        await connection.execute("DELETE FROM post_comments WHERE member_id = ?", [member.id]);
        await connection.execute(
          "DELETE FROM post_keywords WHERE post_id IN (SELECT id FROM posts WHERE member_id = ?)",
          [member.id],
        );
        await connection.execute("DELETE FROM posts WHERE member_id = ?", [member.id]);
        await connection.execute("DELETE FROM member_projects WHERE member_id = ?", [member.id]);
        for (const table of [
          "member_auth_tokens", "member_sessions", "member_oauth_link_intents",
          "member_oauth_accounts", "member_email_credentials", "member_profiles",
          "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [member.id]);
        await connection.execute("DELETE FROM members WHERE id = ?", [member.id]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);
