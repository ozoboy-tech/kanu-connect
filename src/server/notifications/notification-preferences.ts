import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "@/modules/notifications/domain/notification-input";

export async function getNotificationPreferences(
  connection: PoolConnection, memberPublicId: string,
): Promise<NotificationPreferences | null> {
  const [rows] = await connection.execute<(RowDataPacket & {
    projectsEnabled: number | null; communityEnabled: number | null;
    opportunitiesEnabled: number | null; solutionsEnabled: number | null;
  })[]>(
    `SELECT pref.projects_enabled AS projectsEnabled,
            pref.community_enabled AS communityEnabled,
            pref.opportunities_enabled AS opportunitiesEnabled,
            pref.solutions_enabled AS solutionsEnabled
     FROM members member
     JOIN member_profiles profile ON profile.member_id = member.id
     LEFT JOIN member_notification_preferences pref ON pref.member_id = member.id
     WHERE member.public_id = ?`,
    [memberPublicId],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    projectsEnabled: Boolean(row.projectsEnabled ?? defaultNotificationPreferences.projectsEnabled),
    communityEnabled: Boolean(row.communityEnabled ?? defaultNotificationPreferences.communityEnabled),
    opportunitiesEnabled: Boolean(row.opportunitiesEnabled ?? defaultNotificationPreferences.opportunitiesEnabled),
    solutionsEnabled: Boolean(row.solutionsEnabled ?? defaultNotificationPreferences.solutionsEnabled),
  };
}

export async function saveNotificationPreferences(
  connection: PoolConnection, memberPublicId: string, value: unknown,
): Promise<NotificationPreferences | null> {
  const input = parseNotificationPreferences(value);
  await connection.beginTransaction();
  try {
    const [members] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT member.id FROM members member
       JOIN member_profiles profile ON profile.member_id = member.id
       WHERE member.public_id = ? FOR UPDATE`,
      [memberPublicId],
    );
    if (!members[0]) { await connection.rollback(); return null; }
    const flags = [input.projectsEnabled, input.communityEnabled,
      input.opportunitiesEnabled, input.solutionsEnabled];
    await connection.execute(
      `INSERT INTO member_notification_preferences
       (member_id, projects_enabled, community_enabled, opportunities_enabled, solutions_enabled)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE projects_enabled = VALUES(projects_enabled),
         community_enabled = VALUES(community_enabled),
         opportunities_enabled = VALUES(opportunities_enabled),
         solutions_enabled = VALUES(solutions_enabled)`,
      [members[0].id, ...flags],
    );
    await connection.commit();
    return input;
  } catch (error) { await connection.rollback(); throw error; }
}
