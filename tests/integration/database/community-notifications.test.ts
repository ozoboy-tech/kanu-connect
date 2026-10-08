import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { registerEmail } from "@/server/auth/accounts";
import { createComment, deleteComment } from "@/server/comments/comment-repository";
import { setFollow } from "@/server/members/follow-repository";
import { reviewContent } from "@/server/moderation/moderation-repository";
import { notifyPublication } from "@/server/notifications/community-notifications";
import {
  listNotifications,
  markNotificationRead,
} from "@/server/notifications/notification-repository";
import {
  createPost,
  deletePost,
  updatePost,
} from "@/server/posts/post-repository";
import {
  decideCollaboration,
  requestCollaboration,
} from "@/server/projects/collaboration-repository";
import { createProject } from "@/server/projects/project-repository";
import { reportContent } from "@/server/reports/report-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("notifie les abonnés, les réponses et les mentions sans doublons", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;

  if (!password || !migrationPassword) {
    throw new Error("Mots de passe MySQL absents.");
  }

  await runMigrations("test", migrationPassword);

  const pool = createPool({
    host: "127.0.0.1",
    port: 3306,
    user: "kanu_app_test",
    password,
    database: "kanuconnecttest",
    charset: "utf8mb4",
    timezone: "Z",
    multipleStatements: false,
  });

  const connection = await pool.getConnection();
  const previousModerators = process.env.KANU_MODERATOR_IDS;
  const suffix = randomBytes(8).toString("hex");
  const members: { id: number; publicId: string; handle: string }[] = [];

  try {
    for (const label of ["owner", "alice", "bob", "other"]) {
      const handle = `cn_${label}_${suffix}`;

      await registerEmail(connection, {
        email: `${handle}@example.test`,
        password: "MotDePasse!123456",
        legalName: `Test ${label}`,
        handle,
      });

      const [rows] = await connection.execute<(
        RowDataPacket & { id: number; publicId: string }
      )[]>(
        `SELECT m.id, m.public_id AS publicId FROM members m
         JOIN member_profiles profile ON profile.member_id = m.id
         WHERE profile.handle = ?`,
        [handle],
      );

      members.push({ ...rows[0], handle });
    }

    const [owner, alice, bob, other] = members;

    const input = {
      kind: "question" as const,
      space: "questions" as const,
      title: "Question notifications",
      body: "Bonjour",
      code: null,
      codeLanguage: null,
      keywords: ["typescript"],
    };

    const recipients = async (sourceId: string) => {
      const [rows] = await connection.execute<(
        RowDataPacket & { memberId: string; kind: string }
      )[]>(
        `SELECT m.public_id AS memberId, n.kind FROM member_notifications n
         JOIN members m ON m.id = n.recipient_id WHERE n.source_id = ?`,
        [sourceId],
      );

      return rows.map((row) => `${row.memberId}:${row.kind}`).sort();
    };

    await setFollow(connection, owner.handle, alice.publicId, true);

    const body = `@${bob.handle} @${bob.handle} @${owner.handle}`;
    const post = await createPost(connection, owner.publicId, { ...input, body });

    expect(await recipients(post.id)).toEqual([
      `${alice.publicId}:publication`,
      `${bob.publicId}:mention`,
    ].sort());

    await setFollow(connection, owner.handle, bob.publicId, true);

    const second = await createPost(connection, owner.publicId, { ...input, body });

    expect(await recipients(second.id)).toEqual([
      `${alice.publicId}:publication`,
      `${bob.publicId}:mention`,
    ].sort());

    const [postRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM posts WHERE public_id = ?",
      [second.id],
    );

    await notifyPublication(connection, postRows[0].id, owner.id, body);
    expect(await recipients(second.id)).toHaveLength(2);

    await setFollow(connection, owner.handle, bob.publicId, false);

    const third = await createPost(connection, owner.publicId, input);
    expect(await recipients(third.id)).toEqual([`${alice.publicId}:publication`]);

    const root = await createComment(connection, post.id, alice.publicId, {
      parentId: null,
      body: `@${owner.handle} @${bob.handle} @${alice.handle}`,
    });

    expect(await recipients(root.id)).toEqual([
      `${owner.publicId}:reply`,
      `${bob.publicId}:mention`,
    ].sort());

    const nested = await createComment(connection, post.id, bob.publicId, {
      parentId: root.id,
      body: `@${alice.handle} @${other.handle} @${bob.handle}`,
    });

    expect(await recipients(nested.id)).toEqual([
      `${alice.publicId}:reply`,
      `${other.publicId}:mention`,
    ].sort());

    const self = await createComment(connection, post.id, owner.publicId, {
      parentId: null,
      body: "@unknown_member_123",
    });

    expect(await recipients(self.id)).toHaveLength(0);

    expect(await updatePost(connection, second.id, owner.publicId, {
      ...input,
      body: `Modification @${other.handle}`,
    })).toBe("ok");

    expect(await recipients(second.id)).toHaveLength(2);

    const own = await listNotifications(connection, other.publicId);
    expect(own.notifications).toHaveLength(1);
    expect(own.notifications[0]).toMatchObject({
      kind: "mention",
      postId: post.id,
    });

    expect(Object.keys(own.notifications[0]).sort()).toEqual([
      "actorHandle",
      "createdAt",
      "id",
      "kind",
      "postId",
      "postTitle",
      "readAt",
    ]);

    expect(
      await markNotificationRead(connection, owner.publicId, own.notifications[0].id),
    ).toBe("not_found");

    process.env.KANU_MODERATOR_IDS = owner.publicId;

    await reportContent(connection, "comment", nested.id, owner.publicId, "spam");

    expect(
      await reviewContent(
        connection, "comment", nested.id, owner.publicId, "hide", "Test",
      ),
    ).toBe("ok");

    expect(
      (await listNotifications(connection, other.publicId)).notifications,
    ).toHaveLength(0);

    await reviewContent(
      connection, "comment", nested.id, owner.publicId, "restore", "Test",
    );

    expect(
      (await listNotifications(connection, other.publicId)).unreadCount,
    ).toBe(1);

    expect(
      await markNotificationRead(connection, other.publicId, own.notifications[0].id),
    ).toBe("ok");

    expect(
      (await listNotifications(connection, other.publicId)).unreadCount,
    ).toBe(0);

    await reportContent(connection, "post", post.id, alice.publicId, "spam");
    await reviewContent(
      connection, "post", post.id, owner.publicId, "hide", "Test",
    );

    expect(
      (await listNotifications(connection, bob.publicId)).notifications.some(
        (item) => "postId" in item && item.postId === post.id,
      ),
    ).toBe(false);

    await reviewContent(
      connection, "post", post.id, owner.publicId, "restore", "Test",
    );

    await deleteComment(connection, post.id, nested.id, bob.publicId);

    expect(
      (await listNotifications(connection, other.publicId)).notifications,
    ).toHaveLength(0);

    await deletePost(connection, post.id, owner.publicId);

    expect(
      (await listNotifications(connection, alice.publicId)).notifications.some(
        (item) => "postId" in item && item.postId === post.id,
      ),
    ).toBe(false);

    const project = await createProject(connection, owner.publicId, {
      title: "Projet",
      summary: "Résumé",
      description: "Description",
      status: "building",
      technologies: ["TypeScript"],
      repositoryUrl: null,
      demoUrl: null,
    });

    await requestCollaboration(
      connection, project.id, alice.publicId, "Je participe.",
    );

    await decideCollaboration(
      connection, project.id, owner.publicId, alice.publicId, "accepted",
    );

    for (let index = 0; index < 21; index++) {
      await createPost(connection, owner.publicId, input);
    }

    const latest = await listNotifications(connection, alice.publicId);
    const older = await listNotifications(
      connection, alice.publicId, latest.nextCursor,
    );

    expect(latest.notifications).toHaveLength(20);
    expect(older.nextCursor).toBeNull();

    const all = [...latest.notifications, ...older.notifications];

    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(all.some((item) => item.kind === "accepted")).toBe(true);
    expect(all.some((item) => item.kind === "publication")).toBe(true);
  } finally {
    try {
      await connection.rollback();

      // Supprimer les réponses avant leurs commentaires parents.
      for (let depth = 4; depth >= 0; depth--) {
        for (const member of members) {
          await connection.execute(
            `DELETE FROM post_comments
             WHERE depth = ? AND post_id IN (
               SELECT id FROM posts WHERE member_id = ?
             )`,
            [depth, member.id],
          );
        }
      }

      // Supprimer les mots-clés avant leurs publications.
      for (const member of members) {
        await connection.execute(
          `DELETE FROM post_keywords
           WHERE post_id IN (
             SELECT id FROM posts WHERE member_id = ?
           )`,
          [member.id],
        );

        await connection.execute(
          "DELETE FROM posts WHERE member_id = ?",
          [member.id],
        );

        await connection.execute(
          "DELETE FROM member_projects WHERE member_id = ?",
          [member.id],
        );
      }

      for (const member of members) {
        for (const table of [
          "member_auth_tokens",
          "member_sessions",
          "member_oauth_link_intents",
          "member_oauth_accounts",
          "member_email_credentials",
          "member_profiles",
          "member_private_identities",
        ]) {
          await connection.query(
            `DELETE FROM ${table} WHERE member_id = ?`, [member.id],
          );
        }

        await connection.execute(
          "DELETE FROM members WHERE id = ?", [member.id],
        );
      }
    } finally {
      if (previousModerators === undefined) {
        delete process.env.KANU_MODERATOR_IDS;
      } else {
        process.env.KANU_MODERATOR_IDS = previousModerators;
      }

      connection.release();
      await pool.end();
    }
  }
}, 90_000);
