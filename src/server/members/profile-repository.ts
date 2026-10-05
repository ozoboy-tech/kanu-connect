import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import type { ProfileUpdate } from "@/modules/members/domain/profile-input";

interface ProfileRow extends RowDataPacket {
  memberId: number;
  publicId: string;
  handle: string;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  legalName?: string;
}

export interface PublicProfile {
  publicId: string;
  handle: string;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  hobbies: string[];
}

export interface OwnProfile extends PublicProfile {
  legalName: string;
}

async function getLabels(
  connection: PoolConnection,
  table: "member_profile_skills" | "member_profile_hobbies",
  memberId: number,
): Promise<string[]> {
  const [rows] = await connection.execute<(RowDataPacket & { label: string })[]>(
    `SELECT label FROM ${table} WHERE member_id = ? ORDER BY label`,
    [memberId],
  );
  return rows.map((row) => row.label);
}

async function makePublic(
  connection: PoolConnection,
  row: ProfileRow,
): Promise<PublicProfile> {
  const skills = await getLabels(connection, "member_profile_skills", row.memberId);
  const hobbies = await getLabels(connection, "member_profile_hobbies", row.memberId);
  return {
    publicId: row.publicId,
    handle: row.handle,
    photoUrl: row.photoUrl,
    bio: row.bio,
    location: row.location,
    skills,
    hobbies,
  };
}

export async function getPublicProfile(
  connection: PoolConnection,
  handle: string,
): Promise<PublicProfile | null> {
  const [rows] = await connection.execute<ProfileRow[]>(
    `SELECT p.member_id AS memberId, m.public_id AS publicId,
            p.handle, p.photo_url AS photoUrl, p.bio, p.location
     FROM member_profiles p
     JOIN members m ON m.id = p.member_id
     WHERE p.handle = ? LIMIT 1`,
    [handle],
  );
  return rows[0] ? makePublic(connection, rows[0]) : null;
}

export async function getOwnProfile(
  connection: PoolConnection,
  publicId: string,
): Promise<OwnProfile | null> {
  const [rows] = await connection.execute<ProfileRow[]>(
    `SELECT p.member_id AS memberId, m.public_id AS publicId,
            p.handle, p.photo_url AS photoUrl, p.bio, p.location,
            i.legal_name AS legalName
     FROM members m
     JOIN member_profiles p ON p.member_id = m.id
     JOIN member_private_identities i ON i.member_id = m.id
     WHERE m.public_id = ? LIMIT 1`,
    [publicId],
  );
  if (!rows[0]?.legalName) return null;
  return { ...await makePublic(connection, rows[0]), legalName: rows[0].legalName };
}

export async function updateOwnProfile(
  connection: PoolConnection,
  publicId: string,
  input: ProfileUpdate,
): Promise<OwnProfile | null> {
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<ProfileRow[]>(
      `SELECT p.member_id AS memberId
       FROM members m
       JOIN member_profiles p ON p.member_id = m.id
       WHERE m.public_id = ? FOR UPDATE`,
      [publicId],
    );
    const memberId = rows[0]?.memberId;
    if (!memberId) {
      await connection.rollback();
      return null;
    }
    await connection.execute(
      `UPDATE member_profiles
       SET handle = ?, photo_url = ?, bio = ?, location = ?,
           updated_at = UTC_TIMESTAMP(3)
       WHERE member_id = ?`,
      [input.handle, input.photoUrl, input.bio, input.location, memberId],
    );
    for (const [table, entries] of [
      ["member_profile_skills", input.skills],
      ["member_profile_hobbies", input.hobbies],
    ] as const) {
      await connection.execute(`DELETE FROM ${table} WHERE member_id = ?`, [memberId]);
      for (const label of entries) {
        await connection.execute(
          `INSERT INTO ${table} (member_id, label) VALUES (?, ?)`,
          [memberId, label],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return getOwnProfile(connection, publicId);
}