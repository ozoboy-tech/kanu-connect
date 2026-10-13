import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { parseDiscoveryPreferences, type DiscoveryPreferences } from "@/modules/discovery/domain/discovery-input";

const defaults: DiscoveryPreferences = {
  topics: [], welcomeCompleted: false, tourCompleted: false, remindersEnabled: true,
};

export async function getDiscoveryPreferences(connection: PoolConnection, publicId: string) {
  const [rows] = await connection.execute<(RowDataPacket & {
    memberId: number; welcomeCompleted: number | null;
    tourCompleted: number | null; remindersEnabled: number | null;
  })[]>(`SELECT m.id AS memberId, p.welcome_completed AS welcomeCompleted,
      p.tour_completed AS tourCompleted, p.reminders_enabled AS remindersEnabled
    FROM members m JOIN member_profiles profile ON profile.member_id = m.id
    LEFT JOIN member_discovery_preferences p ON p.member_id = m.id
    WHERE m.public_id = ?`, [publicId]);
  if (!rows[0]) return null;
  const [topics] = await connection.execute<(RowDataPacket & { keyword: string })[]>(
    "SELECT keyword FROM member_followed_topics WHERE member_id = ? ORDER BY keyword",
    [rows[0].memberId],
  );
  return { topics: topics.map((row) => row.keyword),
    welcomeCompleted: Boolean(rows[0].welcomeCompleted ?? defaults.welcomeCompleted),
    tourCompleted: Boolean(rows[0].tourCompleted ?? defaults.tourCompleted),
    remindersEnabled: Boolean(rows[0].remindersEnabled ?? defaults.remindersEnabled) };
}

export async function saveDiscoveryPreferences(
  connection: PoolConnection, publicId: string, value: DiscoveryPreferences,
): Promise<DiscoveryPreferences | null> {
  const input = parseDiscoveryPreferences(value);
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT m.id FROM members m JOIN member_profiles p ON p.member_id = m.id
       WHERE m.public_id = ? FOR UPDATE`, [publicId],
    );
    if (!rows[0]) { await connection.rollback(); return null; }
    const memberId = rows[0].id;
    await connection.execute(`INSERT INTO member_discovery_preferences
      (member_id, welcome_completed, tour_completed, reminders_enabled) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE welcome_completed = ?, tour_completed = ?, reminders_enabled = ?`,
    [memberId, input.welcomeCompleted, input.tourCompleted, input.remindersEnabled,
      input.welcomeCompleted, input.tourCompleted, input.remindersEnabled]);
    await connection.execute("DELETE FROM member_followed_topics WHERE member_id = ?", [memberId]);
    for (const topic of input.topics) {
      await connection.execute("INSERT INTO member_followed_topics (member_id, keyword) VALUES (?, ?)", [memberId, topic]);
    }
    await connection.commit();
    return input;
  } catch (error) { await connection.rollback(); throw error; }
}

export async function publicTopics(connection: PoolConnection, handle: string): Promise<string[]> {
  const [rows] = await connection.execute<(RowDataPacket & { keyword: string })[]>(
    `SELECT topic.keyword FROM member_followed_topics topic
     JOIN member_profiles profile ON profile.member_id = topic.member_id
     WHERE profile.handle = ? ORDER BY topic.keyword`, [handle],
  );
  return rows.map((row) => row.keyword);
}
