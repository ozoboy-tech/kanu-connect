import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface SuggestedMember { handle: string; bio: string | null }

export async function suggestedMembers(connection: PoolConnection, viewerId: string): Promise<SuggestedMember[]> {
  const [rows] = await connection.execute<(RowDataPacket & SuggestedMember)[]>(
    `SELECT profile.handle, profile.bio,
      (SELECT COUNT(*) FROM member_profile_skills candidate
       WHERE candidate.member_id = profile.member_id AND
        (EXISTS (SELECT 1 FROM member_profile_skills own
          WHERE own.member_id = viewer.id AND own.label = candidate.label)
         OR EXISTS (SELECT 1 FROM member_followed_topics topic
          WHERE topic.member_id = viewer.id AND topic.keyword = candidate.label))) AS sharedInterests
     FROM member_profiles profile JOIN members viewer ON viewer.public_id = ?
     JOIN members candidate_member ON candidate_member.id = profile.member_id
     WHERE profile.member_id <> viewer.id AND candidate_member.account_status = 'active'
       AND NOT EXISTS (SELECT 1 FROM member_blocks b WHERE
         (b.blocker_id = viewer.id AND b.blocked_id = profile.member_id) OR
         (b.blocked_id = viewer.id AND b.blocker_id = profile.member_id))
       AND NOT EXISTS
       (SELECT 1 FROM member_follows f WHERE f.follower_id = viewer.id AND f.followed_id = profile.member_id)
     ORDER BY sharedInterests DESC, profile.handle ASC, profile.member_id ASC LIMIT 6`, [viewerId],
  );
  return rows.map((row) => ({ handle: row.handle, bio: row.bio }));
}
