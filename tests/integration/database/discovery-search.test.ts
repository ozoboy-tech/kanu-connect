import { randomBytes, randomUUID } from "node:crypto";
import { createPool, type ResultSetHeader } from "mysql2/promise";
import { expect, it } from "vitest";
import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { searchPublications } from "@/server/discovery/publication-search";
import { listProfileActivity } from "@/server/discovery/profile-activity";
import { suggestedMembers } from "@/server/discovery/suggestions-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("recherche, trie et personnalise sans exposer les contenus masqués", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({ host: "127.0.0.1", port: 3306, user: "kanu_app_test", password,
    database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z", multipleStatements: false });
  const connection = await pool.getConnection();
  const suffix = randomBytes(6).toString("hex");
  const topic = `topic${suffix}`;
  const members: { id: number; publicId: string; handle: string }[] = [];
  const posts: { id: number; publicId: string }[] = [];
  const query = (extra: Record<string, string> = {}) => parseExploreQuery(new URLSearchParams({ kind: "posts", q: suffix, ...extra }));
  try {
    // Les fonctions exercées ne font que des lectures : rollback retire toutes les fixtures.
    await connection.beginTransaction();
    for (let index = 0; index < 3; index++) {
      const publicId = randomUUID(), handle = `ds_${suffix}_${index}`;
      const [member] = await connection.execute<ResultSetHeader>(
        "INSERT INTO members (public_id, created_at, updated_at) VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))", [publicId]);
      members.push({ id: member.insertId, publicId, handle });
      await connection.execute(`INSERT INTO member_profiles (member_id, handle, bio, created_at, updated_at)
        VALUES (?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [member.insertId, handle, `Profil ${suffix}`]);
      await connection.execute("INSERT INTO member_profile_skills (member_id, label) VALUES (?, ?)", [member.insertId, topic]);
    }
    await connection.execute("INSERT INTO member_follows (follower_id, followed_id, created_at) VALUES (?, ?, UTC_TIMESTAMP(3))", [members[0].id, members[1].id]);
    await connection.execute("INSERT INTO member_followed_topics (member_id, keyword) VALUES (?, ?)", [members[0].id, topic]);
    for (let index = 0; index < 23; index++) {
      const publicId = randomUUID();
      const [post] = await connection.execute<ResultSetHeader>(
        `INSERT INTO posts (public_id, member_id, kind, space, title, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '2026-01-01 00:00:00.000', UTC_TIMESTAMP(3))`,
        [publicId, index === 0 ? members[1].id : members[2].id,
          index < 2 ? "question" : "tip", index < 2 ? "questions" : "sharing",
          `Contenu ${suffix} ${index}`, index === 2 ? "Caractères 50%_!" : "Texte public"]);
      posts.push({ id: post.insertId, publicId });
      await connection.execute("INSERT INTO post_keywords (post_id, keyword) VALUES (?, ?)", [post.insertId, index === 0 ? topic : `tag${suffix}`]);
    }
    await connection.execute(`INSERT INTO post_comments (public_id, post_id, member_id, depth, body, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'Réponse', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [randomUUID(), posts[1].id, members[1].id]);
    await connection.execute(`INSERT INTO post_votes (post_id, voter_id, active, created_at, updated_at)
      VALUES (?, ?, TRUE, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [posts[0].id, members[0].id]);
    await connection.execute(`INSERT INTO post_votes (post_id, voter_id, active, created_at, updated_at)
      VALUES (?, ?, TRUE, UTC_TIMESTAMP(3) - INTERVAL 8 DAY, UTC_TIMESTAMP(3) - INTERVAL 8 DAY)`, [posts[2].id, members[0].id]);
    await connection.execute(`INSERT INTO content_moderation_decisions (post_id, decision, note, reviewed_at)
      VALUES (?, 'hide', 'Fixture', UTC_TIMESTAMP(3))`, [posts[22].id]);
    const first = await searchPublications(connection, query());
    const second = await searchPublications(connection, query({ page: "2" }));
    expect(first.items).toHaveLength(20); expect(first.hasNext).toBe(true);
    expect(second.items).toHaveLength(2); expect(second.hasNext).toBe(false);
    expect(new Set([...first.items, ...second.items].map((post) => post.id)).size).toBe(22);
    expect((await searchPublications(connection, query({ keyword: topic }))).items.map((post) => post.id)).toEqual([posts[0].publicId]);
    expect((await searchPublications(connection, query({ q: "50%_!" }))).items.map((post) => post.id)).toEqual([posts[2].publicId]);
    expect((await searchPublications(connection, query({ q: topic }))).items.map((post) => post.id)).toEqual([posts[0].publicId]);
    expect((await searchPublications(connection, query({ sort: "popular" }))).items[0].id).toBe(posts[0].publicId);
    expect((await searchPublications(connection, query({ sort: "unanswered" }))).items.map((post) => post.id)).toEqual([posts[0].publicId]);
    expect((await searchPublications(connection, query({ feed: "following" }), members[0].publicId)).items.map((post) => post.id)).toEqual([posts[0].publicId]);
    expect((await searchPublications(connection, query({ feed: "foryou" }), members[0].publicId)).items[0].id).toBe(posts[0].publicId);
    const suggestions = await suggestedMembers(connection, members[0].publicId);
    expect(suggestions.map((member) => member.handle)).not.toContain(members[0].handle);
    expect(suggestions.map((member) => member.handle)).not.toContain(members[1].handle);
    expect(suggestions.map((member) => member.handle)).toContain(members[2].handle);
    const activity = await listProfileActivity(connection, members[2].handle, 2);
    expect(activity.items).toHaveLength(1);
    expect(activity.items.some((item) => item.id === posts[22].publicId)).toBe(false);
    expect((await listProfileActivity(connection, members[1].handle, 1)).items.map((item) => item.kind).sort())
      .toEqual(["comment", "post"]);
    await connection.execute(`INSERT INTO content_moderation_decisions (post_id, decision, note, reviewed_at)
      VALUES (?, 'hide', 'Fixture', UTC_TIMESTAMP(3))`, [posts[1].id]);
    expect((await listProfileActivity(connection, members[1].handle, 1)).items.map((item) => item.kind)).toEqual(["post"]);
  } finally {
    try { await connection.rollback(); } finally { connection.release(); await pool.end(); }
  }
});
