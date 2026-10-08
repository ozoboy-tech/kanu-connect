import { randomBytes } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { expect, it } from "vitest";
import { registerEmail } from "@/server/auth/accounts";
import { reviewContent } from "@/server/moderation/moderation-repository";
import {
  countUnreadNotifications, listNotifications, markNotificationRead, notifyProjectOwner,
} from "@/server/notifications/notification-repository";
import { decideCollaboration, requestCollaboration } from "@/server/projects/collaboration-repository";
import { sendDiscussionMessage } from "@/server/projects/discussion-repository";
import { createProject, deleteProject } from "@/server/projects/project-repository";
import { reportContent } from "@/server/reports/report-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("notifie les bons membres et protège la lecture de leurs notifications", async () => {
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
      const handle = `no_${label}_${suffix}`;
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
      title: "Projet notifications", summary: "Construire ensemble",
      description: "Présentation", status: "building" as const,
      technologies: ["TypeScript"], repositoryUrl: null, demoUrl: null,
    };
    const project = await createProject(connection, owner, input);
    const list = (viewer: string, before: string | null = null) =>
      listNotifications(connection, viewer, before);
    expect(await requestCollaboration(connection, project.id, owner, "Moi"))
      .toBe("forbidden");
    const results = await Promise.all([
      requestCollaboration(connection, project.id, alice, "Je participe."),
      requestCollaboration(parallel, project.id, alice, "Je participe."),
    ]);
    expect(results.sort()).toEqual(["duplicate", "ok"]);
    expect((await list(owner)).notifications).toHaveLength(1);
    expect((await list(alice)).notifications).toHaveLength(0);
    await requestCollaboration(connection, project.id, bob, "Moi aussi.");
    expect((await list(owner)).unreadCount).toBe(2);
    await decideCollaboration(connection, project.id, owner, alice, "accepted");
    await decideCollaboration(connection, project.id, owner, bob, "rejected");
    expect(await decideCollaboration(connection, project.id, owner, alice, "rejected"))
      .toBe("conflict");
    const accepted = (await list(alice)).notifications[0];
    expect(accepted.kind).toBe("accepted");
    expect((await list(bob)).notifications.map((item) => item.kind)).toEqual(["rejected"]);

    await sendDiscussionMessage(connection, project.id, owner, "Bienvenue.");
    expect((await list(alice)).notifications.map((item) => item.kind))
      .toEqual(["discussion", "accepted"]);
    expect((await list(owner)).unreadCount).toBe(2);
    await sendDiscussionMessage(connection, project.id, alice, "Merci.");
    expect((await list(owner)).unreadCount).toBe(3);
    expect((await list(alice)).unreadCount).toBe(2);
    expect((await list(bob)).unreadCount).toBe(1);
    expect((await list(other)).notifications).toHaveLength(0);
    expect(await sendDiscussionMessage(connection, project.id, bob, "Interdit"))
      .toBe("not_found");

    expect(await markNotificationRead(connection, other, accepted.id)).toBe("not_found");
    expect(await markNotificationRead(connection, alice, accepted.id)).toBe("ok");
    const readAt = (await list(alice)).notifications.find((item) => item.id === accepted.id)!.readAt;
    expect(readAt).not.toBeNull();
    expect(await markNotificationRead(connection, alice, accepted.id)).toBe("ok");
    expect((await list(alice)).unreadCount).toBe(1);
    expect((await list(alice)).notifications.find((item) => item.id === accepted.id)!.readAt)
      .toBe(readAt);

    const [projects] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM member_projects WHERE public_id = ?", [project.id],
    );
    await connection.beginTransaction();
    await notifyProjectOwner(connection, projects[0].id, members[1].id);
    await connection.rollback();
    expect(await countUnreadNotifications(connection, owner)).toBe(3);

    for (let index = 0; index < 20; index++) {
      await sendDiscussionMessage(connection, project.id, owner, `Message ${index}`);
    }
    const latest = await list(alice);
    const older = await list(alice, latest.nextCursor);
    expect(latest.notifications).toHaveLength(20);
    expect(older.notifications).toHaveLength(2);
    expect(older.nextCursor).toBeNull();
    expect(latest.unreadCount).toBe(21);
    const all = [...latest.notifications, ...older.notifications];
    expect(new Set(all.map((item) => item.id)).size).toBe(22);
    expect(Object.keys(all[0]).sort()).toEqual([
      "actorHandle", "createdAt", "id", "kind", "projectId", "projectTitle", "readAt",
    ]);
    expect(all[0]).toMatchObject({ projectId: project.id });
    expect(all[0].actorHandle).toBe(`no_owner_${suffix}`);
    expect((await list("absent")).notifications).toHaveLength(0);
    await expect(list(owner, "1 OR 1=1")).rejects.toThrow(TypeError);

    process.env.KANU_MODERATOR_IDS = other;
    await reportContent(connection, "project", project.id, bob, "spam");
    expect(await reviewContent(connection, "project", project.id, other, "hide", "Test"))
      .toBe("ok");
    expect((await list(alice)).notifications).toHaveLength(0);
    expect(await countUnreadNotifications(connection, owner)).toBe(0);
    expect(await markNotificationRead(connection, alice, accepted.id)).toBe("not_found");
    await reviewContent(connection, "project", project.id, other, "restore", "Test");
    expect((await list(alice)).unreadCount).toBe(21);
    await deleteProject(connection, project.id, owner);
    expect((await list(alice)).notifications).toHaveLength(0);
    expect(await countUnreadNotifications(connection, owner)).toBe(0);
  } finally {
    try {
      await connection.rollback();
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
