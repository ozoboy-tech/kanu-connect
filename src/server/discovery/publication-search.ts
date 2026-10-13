import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { literalContains, type ExploreQuery } from "@/modules/explore/domain/explore-query";
import { pageResult, pageWindow } from "@/shared/domain/pagination";
import { activeOpportunitySql } from "@/server/opportunities/opportunity-repository";
import { hiddenSql } from "@/server/reports/report-rules";
import type { Kind, Space } from "@/modules/posts/domain/post-input";

export interface PublicationCard {
  id: string;
  authorHandle: string;
  title: string;
  excerpt: string;
  kind: Kind;
  space: Space;
  createdAt: Date;
  votes7Days: number;
}

export async function searchPublications(
  connection: PoolConnection, query: ExploreQuery, viewerId: string | null = null,
) {
  const windowSql = pageWindow(query.page);
  const personal = query.feed === "following" || query.feed === "foryou";
  if (personal && !viewerId) throw new TypeError("Connexion requise pour ce fil.");
  const where = ["p.deleted_at IS NULL", `NOT ${hiddenSql("post", "p")}`, activeOpportunitySql("p")];
  const values: string[] = [];
  if (query.q) {
    where.push(`(p.title LIKE ? ESCAPE '!' OR p.body LIKE ? ESCAPE '!' OR EXISTS
      (SELECT 1 FROM post_keywords k WHERE k.post_id = p.id AND k.keyword LIKE ? ESCAPE '!'))`);
    values.push(...Array<string>(3).fill(literalContains(query.q)));
  }
  if (query.space) { where.push("p.space = ?"); values.push(query.space); }
  if (query.type) { where.push("p.kind = ?"); values.push(query.type); }
  if (query.keyword) {
    where.push("EXISTS (SELECT 1 FROM post_keywords k WHERE k.post_id = p.id AND k.keyword = ?)");
    values.push(query.keyword);
  }
  if (query.sort === "unanswered") {
    where.push("p.kind = 'question'", `NOT EXISTS (SELECT 1 FROM post_comments c
      WHERE c.post_id = p.id AND c.deleted_at IS NULL AND NOT ${hiddenSql("comment", "c")})`);
  }
  const following = `EXISTS (SELECT 1 FROM members viewer
    WHERE viewer.public_id = ? AND (viewer.id = p.member_id OR EXISTS
      (SELECT 1 FROM member_follows f WHERE f.follower_id = viewer.id AND f.followed_id = p.member_id)))`;
  if (query.feed === "following") { where.push(following); values.push(viewerId!); }
  const matches = query.feed === "foryou" ? `(${following} OR EXISTS
    (SELECT 1 FROM post_keywords k JOIN member_followed_topics topic ON topic.keyword = k.keyword
     JOIN members viewer ON viewer.id = topic.member_id WHERE k.post_id = p.id AND viewer.public_id = ?)
    OR EXISTS (SELECT 1 FROM post_keywords k JOIN member_profile_skills skill ON skill.label = k.keyword
     JOIN members viewer ON viewer.id = skill.member_id WHERE k.post_id = p.id AND viewer.public_id = ?)
    OR EXISTS (SELECT 1 FROM post_opportunities o JOIN member_opportunity_categories category ON category.category = o.category
     JOIN members viewer ON viewer.id = category.member_id WHERE o.post_id = p.id AND viewer.public_id = ?))` : "0";
  const [rows] = await connection.execute<(RowDataPacket & PublicationCard)[]>(
    `SELECT p.public_id AS id, profile.handle AS authorHandle, p.title,
      LEFT(p.body, 280) AS excerpt, p.kind, p.space, p.created_at AS createdAt,
      (SELECT COUNT(*) FROM post_votes v WHERE v.post_id = p.id AND v.active = TRUE
        AND v.updated_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY) AS votes7Days,
      ${matches} AS matchesInterest
     FROM posts p JOIN member_profiles profile ON profile.member_id = p.member_id
     WHERE ${where.join(" AND ")}
     ORDER BY ${query.feed === "foryou" ? "matchesInterest DESC, " : ""}
       ${query.sort === "popular" ? "votes7Days DESC, " : ""}p.created_at DESC, p.id DESC ${windowSql}`,
    [...(query.feed === "foryou" ? Array<string>(4).fill(viewerId!) : []), ...values],
  );
  // Ne pas exposer les champs ajoutés par la requête de classement.
  return pageResult(rows.map((row) => ({ id: row.id, authorHandle: row.authorHandle,
    title: row.title, excerpt: row.excerpt, kind: row.kind, space: row.space,
    createdAt: row.createdAt, votes7Days: row.votes7Days })), query.page);
}
