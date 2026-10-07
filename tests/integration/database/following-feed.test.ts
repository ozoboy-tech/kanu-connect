import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";

import { registerEmail } from "@/server/auth/accounts";
import { setFollow } from "@/server/members/follow-repository";
import { createPost, deletePost, listPosts } from "@/server/posts/post-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("filtre les publications par abonnements, espace et suppression", async () => {
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
  const memberIds: number[] = [];
  const postIds: number[] = [];
  try {
    const authors: { id: string; handle: string }[] = [];
    for (const [index, letter] of ["a", "b", "c"].entries()) {
      const handle = `feed_${letter}_${suffix}`;
      await registerEmail(connection, {
        email: `feed_${index}_${suffix}@example.test`,
        password: "MotDePasse!123456", legalName: `Nom Test ${index}`, handle,
      });
      const [rows] = await connection.execute<(
        RowDataPacket & { id: number; publicId: string }
      )[]>(
        `SELECT m.id, m.public_id AS publicId FROM members m
         JOIN member_profiles p ON p.member_id = m.id WHERE p.handle = ?`,
        [handle],
      );
      memberIds.push(rows[0].id);
      authors.push({ id: rows[0].publicId, handle });
    }
    const [self, followed, unrelated] = authors;
    async function publish(authorId: string, title: string, opportunity = false) {
      const post = await createPost(connection, authorId, {
        kind: opportunity ? "opportunity" : "question",
        space: opportunity ? "opportunities" : "questions",
        title, body: "Contenu de test", code: null, codeLanguage: null,
        keywords: ["test"],
      });
      const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM posts WHERE public_id = ?", [post.id],
      );
      postIds.push(rows[0].id);
      return post;
    }
    const ownPost = await publish(self.id, "Mon message");
    const followedPost = await publish(followed.id, "Message suivi");
    const unrelatedPost = await publish(unrelated.id, "Message non suivi");
    const opportunity = await publish(followed.id, "Opportunité suivie", true);

    const ids = (posts: { id: string }[]) => posts.map((post) => post.id);
    expect(ids(await listPosts(connection, null, self.id))).toContain(ownPost.id);
    expect(ids(await listPosts(connection, null, self.id))).not.toContain(followedPost.id);
    expect(await setFollow(connection, followed.handle, self.id, true)).toBe("ok");
    const personal = ids(await listPosts(connection, null, self.id));
    expect(personal).toContain(ownPost.id);
    expect(personal).toContain(followedPost.id);
    expect(personal).toContain(opportunity.id);
    expect(personal).not.toContain(unrelatedPost.id);
    expect(ids(await listPosts(connection, "opportunities", self.id)))
      .toEqual([opportunity.id]);
    expect(ids(await listPosts(connection, null))).toContain(unrelatedPost.id);

    expect(await deletePost(connection, followedPost.id, followed.id)).toBe("ok");
    expect(ids(await listPosts(connection, null, self.id))).not.toContain(followedPost.id);
    expect(await setFollow(connection, followed.handle, self.id, false)).toBe("ok");
    expect(ids(await listPosts(connection, null, self.id))).toEqual([ownPost.id]);
  } finally {
    try {
      for (const id of postIds) {
        await connection.execute("DELETE FROM post_keywords WHERE post_id = ?", [id]);
        await connection.execute("DELETE FROM posts WHERE id = ?", [id]);
      }
      for (const id of memberIds) {
        for (const table of [
          "member_profile_skills", "member_profile_hobbies", "member_auth_tokens",
          "member_sessions", "member_oauth_link_intents", "member_oauth_accounts",
          "member_email_credentials", "member_profiles", "member_private_identities",
        ]) await connection.query(`DELETE FROM ${table} WHERE member_id = ?`, [id]);
        await connection.execute("DELETE FROM members WHERE id = ?", [id]);
      }
    } finally { connection.release(); await pool.end(); }
  }
}, 90_000);
