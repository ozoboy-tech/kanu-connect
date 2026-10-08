import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { registerEmail } from "@/server/auth/accounts";
import { setFollow } from "@/server/members/follow-repository";
import { reviewContent } from "@/server/moderation/moderation-repository";
import { listNotifications } from "@/server/notifications/notification-repository";
import {
  getOpportunityCategories,
  setOpportunityCategories,
  notifyOpportunity,
} from "@/server/opportunities/opportunity-repository";
import {
  createPost, getPost, listPosts, updatePost, deletePost,
} from "@/server/posts/post-repository";
import { reportContent } from "@/server/reports/report-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("filtre, archive et notifie les opportunités selon les catégories suivies", async () => {
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
      const handle = `op_${label}_${suffix}`;

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
    const deadline = new Date(Date.now() + 86_400_000).toISOString();

    const input = {
      kind: "opportunity" as const,
      space: "opportunities" as const,
      title: "Stage Data",
      body: `Annonce @${other.handle} @${alice.handle}`,
      code: null,
      codeLanguage: null,
      keywords: ["stage"],
      opportunity: {
        category: "data-ai" as const,
        deadline,
        applyUrl: "https://example.test/apply",
      },
    };

    const ids = (posts: { id: string }[]) => posts.map((post) => post.id);

    expect(await getOpportunityCategories(connection, alice.publicId))
      .toEqual([]);

    await setOpportunityCategories(connection, alice.publicId, ["data-ai"]);
    await setOpportunityCategories(connection, bob.publicId, ["backend"]);
    await setOpportunityCategories(connection, owner.publicId, ["data-ai"]);

    await expect(
      setOpportunityCategories(connection, alice.publicId, ["unknown"]),
    ).rejects.toThrow(TypeError);

    expect(await getOpportunityCategories(connection, alice.publicId))
      .toEqual(["data-ai"]);

    await expect(
      setOpportunityCategories(connection, "absent", ["data-ai"]),
    ).rejects.toThrow(TypeError);

    await setFollow(connection, owner.handle, alice.publicId, true);
    await setFollow(connection, owner.handle, other.publicId, true);

    const data = await createPost(connection, owner.publicId, input);

    expect(data.opportunity).toEqual({
      ...input.opportunity, archived: false,
    });

    expect(
      (await listNotifications(connection, alice.publicId)).notifications,
    ).toHaveLength(1);
    expect(
      (await listNotifications(connection, bob.publicId)).notifications,
    ).toHaveLength(0);
    expect(
      (await listNotifications(connection, other.publicId)).notifications,
    ).toHaveLength(0);
    expect(
      (await listNotifications(connection, owner.publicId)).notifications,
    ).toHaveLength(0);

    const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM posts WHERE public_id = ?",
      [data.id],
    );

    await notifyOpportunity(connection, rows[0].id);

    expect(
      (await listNotifications(connection, alice.publicId)).notifications,
    ).toHaveLength(1);

    await setOpportunityCategories(connection, alice.publicId, ["backend"]);

    const data2 = await createPost(connection, owner.publicId, input);

    expect(
      (await listNotifications(connection, alice.publicId)).notifications,
    ).toHaveLength(1);

    const backendInput = {
      ...input,
      opportunity: { ...input.opportunity, category: "backend" as const },
    };

    const backend = await createPost(connection, owner.publicId, backendInput);

    expect(
      (await listNotifications(connection, alice.publicId)).notifications,
    ).toHaveLength(2);
    expect(
      (await listNotifications(connection, bob.publicId)).notifications,
    ).toHaveLength(1);

    expect(ids(await listPosts(
      connection, "opportunities", null, { category: "backend" },
    ))).toContain(backend.id);

    expect(ids(await listPosts(
      connection, "opportunities", null, { category: "backend" },
    ))).not.toContain(data.id);

    const personal = ids(await listPosts(
      connection, "opportunities", null, { subscribedBy: alice.publicId },
    ));

    expect(personal).toContain(backend.id);
    expect(personal).not.toContain(data.id);

    expect(
      await updatePost(connection, backend.id, bob.publicId, backendInput),
    ).toBe("forbidden");

    expect(await updatePost(connection, backend.id, owner.publicId, {
      ...backendInput, title: "Stage corrigé",
    })).toBe("ok");

    expect(
      (await listNotifications(connection, alice.publicId)).notifications,
    ).toHaveLength(2);

    await connection.execute(
      `UPDATE post_opportunities
       SET deadline = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND
       WHERE post_id IN (SELECT id FROM posts WHERE public_id = ?)`,
      [data.id],
    );

    expect(
      (await getPost(connection, data.id))?.opportunity?.archived,
    ).toBe(true);

    expect(ids(await listPosts(connection, null))).not.toContain(data.id);

    expect(
      (await listNotifications(connection, alice.publicId)).notifications,
    ).toHaveLength(1);

    await connection.execute(
      `DELETE FROM post_opportunities WHERE post_id IN (
         SELECT id FROM posts WHERE public_id = ?
       )`,
      [data2.id],
    );

    expect((await getPost(connection, data2.id))?.opportunity).toBeNull();
    expect(ids(await listPosts(connection, "opportunities")))
      .not.toContain(data2.id);

    process.env.KANU_MODERATOR_IDS = other.publicId;

    await reportContent(connection, "post", backend.id, bob.publicId, "spam");
    await reviewContent(
      connection, "post", backend.id, other.publicId, "hide", "Test",
    );

    expect(ids(await listPosts(connection, "opportunities")))
      .not.toContain(backend.id);

    expect(
      (await listNotifications(connection, alice.publicId)).unreadCount,
    ).toBe(0);

    await reviewContent(
      connection, "post", backend.id, other.publicId, "restore", "Test",
    );

    expect(
      (await listNotifications(connection, alice.publicId)).unreadCount,
    ).toBe(1);

    expect(
      await deletePost(connection, backend.id, owner.publicId),
    ).toBe("ok");

    expect(
      (await listNotifications(connection, alice.publicId)).unreadCount,
    ).toBe(0);

    await setOpportunityCategories(connection, alice.publicId, []);

    expect(await getOpportunityCategories(connection, alice.publicId))
      .toEqual([]);

    expect(await listPosts(
      connection, "opportunities", null, { subscribedBy: alice.publicId },
    )).toEqual([]);

    await expect(createPost(
      connection, owner.publicId, { ...input, opportunity: null },
    )).rejects.toThrow(TypeError);
  } finally {
    try {
      await connection.rollback();

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

      for (const member of members) {
        await connection.execute(
          `DELETE FROM post_keywords
           WHERE post_id IN (SELECT id FROM posts WHERE member_id = ?)`,
          [member.id],
        );

        await connection.execute(
          "DELETE FROM posts WHERE member_id = ?", [member.id],
        );
      }

      for (const member of members) {
        for (const table of [
          "member_auth_tokens", "member_sessions", "member_oauth_link_intents",
          "member_oauth_accounts", "member_email_credentials",
          "member_profiles", "member_private_identities",
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
