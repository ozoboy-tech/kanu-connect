import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { verifyPassword } from "@/server/auth/password";
import { isAdmin } from "@/server/moderation/moderator";
import { refreshSolution } from "@/server/solutions/solution-repository";

export type AccountStatus = "active" | "deactivated" | "suspended" | "deleted";
export type AccountRole = "member" | "moderator" | "admin";

interface AccountRow extends RowDataPacket {
  id: number;
  status: AccountStatus;
  role: AccountRole;
  reason: string | null;
  passwordHash: string | null;
}

export async function getAccount(
  connection: PoolConnection, publicId: string, lock = false,
): Promise<AccountRow | null> {
  const [rows] = await connection.execute<AccountRow[]>(
    `SELECT m.id, m.account_status AS status, m.account_role AS role,
            m.suspension_reason AS reason, c.password_hash AS passwordHash
     FROM members m
     LEFT JOIN member_email_credentials c ON c.member_id = m.id
     WHERE m.public_id = ? ${lock ? "FOR UPDATE" : ""}`,
    [publicId],
  );
  return rows[0] ?? null;
}

export async function reactivateForLogin(
  connection: PoolConnection, publicId: string,
): Promise<boolean> {
  await connection.execute(
    `UPDATE members SET account_status = 'active', updated_at = UTC_TIMESTAMP(3)
     WHERE public_id = ? AND account_status = 'deactivated'`, [publicId],
  );
  return (await getAccount(connection, publicId))?.status === "active";
}

export async function deactivateAccount(
  connection: PoolConnection, publicId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  await connection.beginTransaction();
  try {
    const account = await getAccount(connection, publicId, true);
    if (!account || account.status !== "active") {
      await connection.rollback(); return "not_found";
    }
    if (account.role === "admin" || await isAdmin(connection, publicId)) {
      await connection.rollback(); return "forbidden";
    }
    await connection.execute(
      `UPDATE members SET account_status = 'deactivated', updated_at = UTC_TIMESTAMP(3)
       WHERE id = ?`, [account.id],
    );
    await connection.execute("DELETE FROM member_sessions WHERE member_id = ?", [account.id]);
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}

export async function deleteAccount(
  connection: PoolConnection, publicId: string, password: string | null,
  confirmation: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  if (confirmation !== "SUPPRIMER MON COMPTE") return "forbidden";
  await connection.beginTransaction();
  try {
    const account = await getAccount(connection, publicId, true);
    if (!account || account.status !== "active") {
      await connection.rollback(); return "not_found";
    }
    if (account.role === "admin" || await isAdmin(connection, publicId) ||
        (account.passwordHash && (!password ||
         !await verifyPassword(password, account.passwordHash)))) {
      await connection.rollback(); return "forbidden";
    }
    const id = account.id;
    const [affectedQuestions] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT DISTINCT p.id FROM posts p
       LEFT JOIN post_comments c ON c.post_id = p.id
       WHERE p.member_id = ? OR c.member_id = ? ORDER BY p.id`, [id, id],
    );
    // L'identifiant technique reste pour préserver les clés étrangères et les réponses.
    await connection.execute(
      `UPDATE members SET account_status = 'deleted', account_role = 'member',
         suspension_reason = NULL, deleted_at = UTC_TIMESTAMP(3),
         updated_at = UTC_TIMESTAMP(3) WHERE id = ?`, [id],
    );
    await connection.execute(
      `UPDATE member_profiles SET handle = ?,
         photo_url = NULL, bio = NULL, location = NULL,
         updated_at = UTC_TIMESTAMP(3) WHERE member_id = ?`,
      [`d_${randomBytes(12).toString("hex")}`, id],
    );
    await connection.execute(
      `UPDATE posts SET title = 'Publication supprimée', body = 'Contenu supprimé',
         code = NULL, code_language = NULL, deleted_at = UTC_TIMESTAMP(3),
         updated_at = UTC_TIMESTAMP(3)
       WHERE member_id = ?`, [id],
    );
    await connection.execute(
      `UPDATE post_comments SET body = 'Commentaire supprimé',
         deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP(3)),
         updated_at = UTC_TIMESTAMP(3) WHERE member_id = ?`, [id],
    );
    await connection.execute(
      `UPDATE member_projects SET title = 'Projet supprimé',
         summary = 'Contenu supprimé', description = 'Contenu supprimé',
         technologies = JSON_ARRAY('supprimé'), recruitment_roles = JSON_ARRAY(),
         repository_url = NULL, demo_url = NULL, deleted_at = UTC_TIMESTAMP(3),
         updated_at = UTC_TIMESTAMP(3) WHERE member_id = ?`, [id],
    );
    await connection.execute(
      `DELETE a FROM content_attachments a LEFT JOIN posts p ON p.id = a.post_id
       LEFT JOIN member_projects project ON project.id = a.project_id
       WHERE p.member_id = ? OR project.member_id = ?`, [id, id],
    );
    await connection.execute(
      `DELETE k FROM post_keywords k JOIN posts p ON p.id = k.post_id
       WHERE p.member_id = ?`, [id],
    );
    await connection.execute(
      `DELETE o FROM post_opportunities o JOIN posts p ON p.id = o.post_id
       WHERE p.member_id = ?`, [id],
    );
    await connection.execute(
      `DELETE FROM project_discussion_messages WHERE author_id = ?`, [id],
    );
    await connection.execute(
      `DELETE FROM project_collaboration_requests WHERE member_id = ?`, [id],
    );
    for (const table of ["post_votes", "comment_votes", "project_votes"]) {
      await connection.execute(`DELETE FROM ${table} WHERE voter_id = ?`, [id]);
    }
    for (const question of affectedQuestions) {
      await refreshSolution(connection, question.id);
    }
    await connection.execute(
      `DELETE FROM member_notifications WHERE actor_id = ? OR recipient_id = ?`, [id, id],
    );
    // Purge des identifiants et des données privées liées au compte.
    for (const table of [
      "member_sessions", "member_auth_tokens", "member_oauth_link_intents",
      "member_oauth_accounts", "member_email_credentials",
      "member_private_identities", "member_profile_skills",
      "member_profile_hobbies", "member_follows", "member_blocks",
      "post_bookmarks", "project_bookmarks", "member_followed_topics",
      "member_opportunity_categories", "member_discovery_preferences",
      "member_notification_preferences",
      "member_reputation_events", "member_reputation_days",
      "member_streaks", "member_streak_days", "post_solution_rewards",
      "content_reports",
    ]) {
      if (table === "member_follows" || table === "member_blocks") {
        const columns = table === "member_follows"
          ? ["follower_id", "followed_id"] : ["blocker_id", "blocked_id"];
        await connection.execute(
          `DELETE FROM ${table} WHERE ${columns[0]} = ? OR ${columns[1]} = ?`, [id, id],
        );
      } else if (table === "content_reports") {
        await connection.execute("DELETE FROM content_reports WHERE reporter_id = ?", [id]);
      } else {
        await connection.execute(`DELETE FROM ${table} WHERE member_id = ?`, [id]);
      }
    }
    await connection.commit();
    return "ok";
  } catch (error) { await connection.rollback(); throw error; }
}
