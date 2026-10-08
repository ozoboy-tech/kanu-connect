import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  parseOpportunityCategories,
  type OpportunityCategory,
  type OpportunityDetails,
  type OpportunityInput,
} from "@/modules/opportunities/domain/opportunity-input";

export function activeOpportunitySql(alias: string): string {
  return `(${alias}.kind <> 'opportunity' OR EXISTS (
    SELECT 1 FROM post_opportunities opportunity
    WHERE opportunity.post_id = ${alias}.id
      AND opportunity.deadline > UTC_TIMESTAMP(3)
  ))`;
}

export async function getOpportunity(
  connection: PoolConnection,
  postId: number,
): Promise<OpportunityDetails | null> {
  const [rows] = await connection.execute<(RowDataPacket & {
    category: OpportunityCategory;
    deadline: Date;
    applyUrl: string;
    archived: number;
  })[]>(
    `SELECT category, deadline, apply_url AS applyUrl,
            (deadline <= UTC_TIMESTAMP(3)) AS archived
     FROM post_opportunities WHERE post_id = ?`,
    [postId],
  );

  const row = rows[0];

  return row ? {
    category: row.category,
    deadline: row.deadline.toISOString(),
    applyUrl: row.applyUrl,
    archived: row.archived === 1,
  } : null;
}

// À appeler dans la transaction de création ou de modification du contenu.
export async function saveOpportunity(
  connection: PoolConnection,
  postId: number,
  input: OpportunityInput | null,
): Promise<void> {
  if (!input) {
    await connection.execute(
      "DELETE FROM post_opportunities WHERE post_id = ?",
      [postId],
    );
    return;
  }

  await connection.execute(
    `INSERT INTO post_opportunities (post_id, category, deadline, apply_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE category = ?, deadline = ?, apply_url = ?`,
    [
      postId, input.category, new Date(input.deadline), input.applyUrl,
      input.category, new Date(input.deadline), input.applyUrl,
    ],
  );
}

// À appeler dans la transaction de création du contenu.
export async function notifyOpportunity(
  connection: PoolConnection,
  postId: number,
): Promise<void> {
  await connection.execute(
    `INSERT INTO member_notifications
     (post_id, recipient_id, actor_id, kind, source_id, created_at)
     SELECT p.id, profile.member_id, p.member_id, 'publication',
            p.public_id, UTC_TIMESTAMP(3)
     FROM posts p
     JOIN post_opportunities opportunity ON opportunity.post_id = p.id
     JOIN member_opportunity_categories subscription
       ON subscription.category = opportunity.category
     JOIN member_profiles profile ON profile.member_id = subscription.member_id
     JOIN member_private_identities identity_record
       ON identity_record.member_id = profile.member_id
     WHERE p.id = ? AND p.kind = 'opportunity' AND p.deleted_at IS NULL
       AND opportunity.deadline > UTC_TIMESTAMP(3)
       AND profile.member_id <> p.member_id
     ON DUPLICATE KEY UPDATE id = member_notifications.id`,
    [postId],
  );
}

export async function getOpportunityCategories(
  connection: PoolConnection,
  memberId: string,
): Promise<OpportunityCategory[]> {
  const [rows] = await connection.execute<(
    RowDataPacket & { category: OpportunityCategory }
  )[]>(
    `SELECT subscription.category
     FROM member_opportunity_categories subscription
     JOIN members m ON m.id = subscription.member_id
     WHERE m.public_id = ?`,
    [memberId],
  );

  return parseOpportunityCategories(rows.map((row) => row.category));
}

export async function setOpportunityCategories(
  connection: PoolConnection,
  memberId: string,
  value: unknown,
): Promise<void> {
  const categories = parseOpportunityCategories(value);

  await connection.beginTransaction();

  try {
    const [members] = await connection.execute<(
      RowDataPacket & { id: number }
    )[]>(
      `SELECT m.id FROM members m
       JOIN member_profiles profile ON profile.member_id = m.id
       JOIN member_private_identities identity_record
         ON identity_record.member_id = m.id
       WHERE m.public_id = ? FOR UPDATE`,
      [memberId],
    );

    if (!members.length) throw new TypeError("Compte incomplet.");

    const id = members[0].id;

    await connection.execute(
      "DELETE FROM member_opportunity_categories WHERE member_id = ?",
      [id],
    );

    for (const category of categories) {
      await connection.execute(
        "INSERT INTO member_opportunity_categories (member_id, category) VALUES (?, ?)",
        [id, category],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
