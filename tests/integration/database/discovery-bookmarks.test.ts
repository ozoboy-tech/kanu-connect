import { randomBytes, randomUUID } from "node:crypto";
import { createPool, type ResultSetHeader } from "mysql2/promise";
import { expect, it } from "vitest";
import { getBookmark, listBookmarks, setBookmark } from "@/server/bookmarks/bookmark-repository";
import { getDiscoveryPreferences, saveDiscoveryPreferences } from "@/server/discovery/preferences-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("conserve les préférences et les favoris privés sans doublons", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({ host: "127.0.0.1", port: 3306, user: "kanu_app_test", password,
    database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z", multipleStatements: false });
  const connection = await pool.getConnection(), parallel = await pool.getConnection();
  const suffix = randomBytes(6).toString("hex");
  const members: { id: number; publicId: string }[] = [];
  let postId: number | undefined, projectId: number | undefined;
  const postPublicId = randomUUID(), projectPublicId = randomUUID();
  try {
    for (let index = 0; index < 2; index++) {
      const publicId = randomUUID();
      const [member] = await connection.execute<ResultSetHeader>(
        "INSERT INTO members (public_id, created_at, updated_at) VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))", [publicId]);
      members.push({ id: member.insertId, publicId });
      await connection.execute(`INSERT INTO member_profiles (member_id, handle, created_at, updated_at)
        VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [member.insertId, `db_${suffix}_${index}`]);
    }
    const [post] = await connection.execute<ResultSetHeader>(
      `INSERT INTO posts (public_id, member_id, kind, space, title, body, created_at, updated_at)
       VALUES (?, ?, 'tip', 'sharing', 'Publication enregistrée', 'Texte', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [postPublicId, members[0].id]);
    postId = post.insertId;
    const [project] = await connection.execute<ResultSetHeader>(
      `INSERT INTO member_projects (public_id, member_id, title, summary, description, status, technologies, created_at, updated_at)
       VALUES (?, ?, 'Projet enregistré', 'Résumé', 'Présentation', 'building', '["React"]', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [projectPublicId, members[0].id]);
    projectId = project.insertId;
    const prefs = { topics: ["react", "mysql"], welcomeCompleted: true, tourCompleted: true, remindersEnabled: false };
    expect(await saveDiscoveryPreferences(connection, members[0].publicId, prefs)).toEqual(prefs);
    expect(await getDiscoveryPreferences(parallel, members[0].publicId)).toEqual({ ...prefs, topics: ["mysql", "react"] });
    expect((await getDiscoveryPreferences(connection, members[1].publicId))?.topics).toEqual([]);
    expect(await Promise.all([
      setBookmark(connection, "post", postPublicId, members[0].publicId, true),
      setBookmark(parallel, "post", postPublicId, members[0].publicId, true),
    ])).toEqual(["ok", "ok"]);
    expect(await setBookmark(connection, "project", projectPublicId, members[0].publicId, true)).toBe("ok");
    expect((await listBookmarks(connection, members[0].publicId, 1)).items).toHaveLength(2);
    expect((await listBookmarks(connection, members[1].publicId, 1)).items).toEqual([]);
    expect(await getBookmark(connection, "post", postPublicId, members[1].publicId)).toBe(false);
    expect(await setBookmark(connection, "post", postPublicId, members[1].publicId, false)).toBe("ok");
    expect(await getBookmark(connection, "post", postPublicId, members[0].publicId)).toBe(true);
    await connection.execute(`INSERT INTO content_moderation_decisions (post_id, decision, note, reviewed_at)
      VALUES (?, 'hide', 'Fixture', UTC_TIMESTAMP(3))`, [postId]);
    expect(await getBookmark(connection, "post", postPublicId, members[0].publicId)).toBeNull();
    expect(await setBookmark(connection, "post", postPublicId, members[1].publicId, true)).toBe("not_found");
    expect((await listBookmarks(connection, members[0].publicId, 1)).items.map((item) => item.kind)).toEqual(["project"]);
    expect(await setBookmark(connection, "post", postPublicId, members[0].publicId, false)).toBe("ok");
    await connection.execute("UPDATE member_projects SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?", [projectId]);
    expect((await listBookmarks(connection, members[0].publicId, 1)).items).toEqual([]);
  } finally {
    try {
      await connection.rollback(); await parallel.rollback();
      if (postId) await connection.execute("DELETE FROM posts WHERE id = ?", [postId]);
      if (projectId) await connection.execute("DELETE FROM member_projects WHERE id = ?", [projectId]);
      for (const member of members) {
        await connection.execute("DELETE FROM member_profiles WHERE member_id = ?", [member.id]);
        await connection.execute("DELETE FROM members WHERE id = ?", [member.id]);
      }
    } finally { connection.release(); parallel.release(); await pool.end(); }
  }
});
