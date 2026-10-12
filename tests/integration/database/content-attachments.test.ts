import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { registerEmail } from "@/server/auth/accounts";
import { createPost } from "@/server/posts/post-repository";
import { createProject } from "@/server/projects/project-repository";
import { addAttachments, getAttachment, listAttachments, removeAttachment } from "@/server/attachments/attachment-repository";
import { maxAttachmentBytes, validateAttachment } from "@/modules/attachments/domain/attachment-input";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("conserve les fichiers, protège leur gestion et leur visibilité, et sérialise le quota", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD, migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({ host: "127.0.0.1", port: 3306, user: "kanu_app_test", password, database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z", multipleStatements: false });
  const connection = await pool.getConnection(), parallel = await pool.getConnection();
  const members: { id: number; publicId: string }[] = [];
  const suffix = randomBytes(6).toString("hex");
  const text = validateAttachment("guide.txt", "text/plain", new TextEncoder().encode("Bonjour Kanu"));
  const image = validateAttachment("capture.png", "image/png", new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=", "base64")));
  try {
    for (const label of ["owner", "other"]) {
      const handle = `att_${label}_${suffix}`;
      await registerEmail(connection, { email: `${handle}@example.test`, password: "MotDePasse!123456", legalName: "Test média", handle });
      const [rows] = await connection.execute<(RowDataPacket & { id: number; publicId: string })[]>("SELECT id, public_id AS publicId FROM members WHERE public_id IN (SELECT m.public_id FROM members m JOIN member_profiles p ON p.member_id=m.id WHERE p.handle=?)", [handle]);
      members.push(rows[0]);
    }
    const [owner, other] = members;
    const post = await createPost(connection, owner.publicId, { title: "Fichiers", body: "Publication avec pièces jointes", kind: "tip", space: "sharing", code: null, codeLanguage: null, keywords: ["tests"] });
    expect(await addAttachments(connection, "post", post.id, other.publicId, [text])).toBe("forbidden");
    expect(await addAttachments(connection, "post", post.id, owner.publicId, [text])).toBe("ok");
    const files = (await listAttachments(connection, "post", post.id))!;
    expect(files).toHaveLength(1);
    expect(Object.keys(files[0]).sort()).toEqual(["filename", "id", "mimeType", "size"]);
    const loaded = (await getAttachment(parallel, "post", post.id, files[0].id))!;
    expect(loaded.data.toString("utf8")).toBe("Bonjour Kanu");
    const large = validateAttachment("limite.txt", "text/plain", new Uint8Array(maxAttachmentBytes).fill(97));
    expect(await addAttachments(connection, "post", post.id, owner.publicId, [large])).toBe("ok");
    const largeFile = (await listAttachments(connection, "post", post.id))!.find((file) => file.filename === "limite.txt")!;
    expect((await getAttachment(parallel, "post", post.id, largeFile.id))?.data.byteLength).toBe(maxAttachmentBytes);
    expect(await removeAttachment(connection, "post", post.id, largeFile.id, owner.publicId)).toBe("ok");
    expect(await removeAttachment(connection, "post", post.id, files[0].id, other.publicId)).toBe("forbidden");
    const project = await createProject(connection, owner.publicId, { title: "Projet média", summary: "Captures", description: "Description", status: "paused", technologies: ["React"], repositoryUrl: null, demoUrl: null });
    expect(await getAttachment(connection, "project", project.id, files[0].id)).toBeNull();
    await expect(addAttachments(connection, "project", project.id, owner.publicId, [text])).rejects.toThrow();
    expect(await addAttachments(connection, "project", project.id, owner.publicId, [image, image])).toBe("ok");
    const simultaneous = await Promise.all([
      addAttachments(connection, "project", project.id, owner.publicId, [image]),
      addAttachments(parallel, "project", project.id, owner.publicId, [image]),
    ]);
    expect(simultaneous.sort()).toEqual(["limit", "ok"]);
    expect(await listAttachments(connection, "project", project.id)).toHaveLength(3);
    const [posts] = await connection.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM posts WHERE public_id=?", [post.id]);
    await connection.execute("INSERT INTO content_moderation_decisions (post_id, moderator_id, decision, note, reviewed_at) VALUES (?, ?, 'hide', 'Test', UTC_TIMESTAMP(3))", [posts[0].id, owner.id]);
    expect(await listAttachments(connection, "post", post.id)).toBeNull();
    expect(await getAttachment(connection, "post", post.id, files[0].id)).toBeNull();
    expect(await addAttachments(connection, "post", post.id, owner.publicId, [text])).toBe("not_found");
    await connection.execute("UPDATE content_moderation_decisions SET decision='restore' WHERE post_id=?", [posts[0].id]);
    expect(await getAttachment(connection, "post", post.id, files[0].id)).not.toBeNull();
    await connection.execute("UPDATE posts SET created_at=UTC_TIMESTAMP(3) - INTERVAL 16 MINUTE WHERE id=?", [posts[0].id]);
    expect(await addAttachments(connection, "post", post.id, owner.publicId, [text])).toBe("forbidden");
    expect(await removeAttachment(connection, "post", post.id, files[0].id, owner.publicId)).toBe("forbidden");
    await connection.execute("UPDATE posts SET created_at=UTC_TIMESTAMP(3) WHERE id=?", [posts[0].id]);
    expect(await removeAttachment(connection, "post", post.id, files[0].id, owner.publicId)).toBe("ok");
    expect(await getAttachment(connection, "post", post.id, files[0].id)).toBeNull();
    await connection.execute("UPDATE member_projects SET deleted_at=UTC_TIMESTAMP(3) WHERE public_id=?", [project.id]);
    expect(await listAttachments(connection, "project", project.id)).toBeNull();
  } finally {
    try {
      await connection.rollback();
      await parallel.rollback();

      for (const member of members) {
        await connection.execute(
          "DELETE FROM post_keywords WHERE post_id IN (SELECT id FROM posts WHERE member_id = ?)",
          [member.id],
        );

        await connection.execute(
          "DELETE FROM posts WHERE member_id=?",
          [member.id],
        );

        await connection.execute(
          "DELETE FROM member_projects WHERE member_id=?",
          [member.id],
        );
      }
      for (const member of members) {
        for (const table of ["member_auth_tokens", "member_sessions", "member_oauth_link_intents", "member_oauth_accounts", "member_email_credentials", "member_profiles", "member_private_identities"]) await connection.query(`DELETE FROM ${table} WHERE member_id=?`, [member.id]);
        await connection.execute("DELETE FROM members WHERE id=?", [member.id]);
      }
    } finally { parallel.release(); connection.release(); await pool.end(); }
  }
}, 90_000);
