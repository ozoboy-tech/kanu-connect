import { randomBytes, randomUUID } from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { chooseHandle } from "@/modules/members/domain/choose-handle";
import { hashPassword, verifyPassword } from "./password";
import { hashToken } from "./session-store";

interface MemberRow extends RowDataPacket {
  publicId: string;
  passwordHash?: string;
  verifiedAt?: Date | null;
  memberId?: number;
  email?: string;
}

function legalNameOf(value: string): string {
  const name = value.trim().replace(/\s+/gu, " ");
  if (name.length < 2 || name.length > 160) {
    throw new TypeError("Nom légal invalide.");
  }
  return name;
}

function emailOf(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new TypeError("Adresse e-mail invalide.");
  }
  return email;
}

function rawToken(): string {
  return randomBytes(32).toString("hex");
}

async function replaceToken(
  connection: PoolConnection,
  memberId: number,
  purpose: "verify" | "reset",
  minutes: number,
): Promise<string> {
  const token = rawToken();
  await connection.execute(
    "DELETE FROM member_auth_tokens WHERE member_id = ? AND purpose = ?",
    [memberId, purpose],
  );
  await connection.execute(
    `INSERT INTO member_auth_tokens
       (token_hash, member_id, purpose, expires_at)
     VALUES (?, ?, ?, UTC_TIMESTAMP(3) + INTERVAL ? MINUTE)`,
    [hashToken(token), memberId, purpose, minutes],
  );
  return token;
}

export async function registerEmail(
  connection: PoolConnection,
  input: {
    email: string;
    password: string;
    legalName: string;
    handle: string | null;
  },
): Promise<{ email: string; token: string }> {
  const email = emailOf(input.email);
  const legalName = legalNameOf(input.legalName);
  const passwordHash = await hashPassword(input.password);
  await connection.beginTransaction();
  try {
    const handle = await chooseHandle(connection, input.handle);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO members (public_id, created_at, updated_at)
       VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [randomUUID()],
    );
    await connection.execute(
      "INSERT INTO member_private_identities (member_id, legal_name) VALUES (?, ?)",
      [result.insertId, legalName],
    );
    await connection.execute(
      `INSERT INTO member_profiles
         (member_id, handle, created_at, updated_at)
       VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [result.insertId, handle],
    );
    await connection.execute(
      `INSERT INTO member_email_credentials
         (member_id, email, password_hash) VALUES (?, ?, ?)`,
      [result.insertId, email, passwordHash],
    );
    const token = await replaceToken(connection, result.insertId, "verify", 60);
    await connection.commit();
    return { email, token };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function resolveOAuthMember(
  connection: PoolConnection,
  provider: string,
  accountId: string,
): Promise<string> {
  if (
    !["google", "github", "gitlab"].includes(provider) ||
    !accountId || accountId.length > 255 ||
    !/^[\x21-\x7e]+$/.test(accountId)
  ) {
    throw new TypeError("Identité OAuth invalide.");
  }
  const lookup = async () => {
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT m.public_id AS publicId
       FROM member_oauth_accounts a
       JOIN members m ON m.id = a.member_id
       WHERE a.provider = ? AND a.provider_account_id = ?`,
      [provider, accountId],
    );
    return rows[0]?.publicId;
  };
  const existing = await lookup();
  if (existing) return existing;

  await connection.beginTransaction();
  try {
    const publicId = randomUUID();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO members (public_id, created_at, updated_at)
       VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [publicId],
    );
    await connection.execute(
      `INSERT INTO member_oauth_accounts
         (provider, provider_account_id, member_id) VALUES (?, ?, ?)`,
      [provider, accountId, result.insertId],
    );
    await connection.commit();
    return publicId;
  } catch (error) {
    await connection.rollback();
    const concurrent = await lookup();
    if (concurrent) return concurrent;
    throw error;
  }
}

export async function createOAuthLinkIntent(
  connection: PoolConnection,
  publicId: string,
  provider: string,
): Promise<string> {
  if (!["google", "github", "gitlab"].includes(provider)) {
    throw new TypeError("Fournisseur invalide.");
  }
  const token = rawToken();
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO member_oauth_link_intents
       (token_hash, member_id, provider, expires_at)
     SELECT ?, id, ?, UTC_TIMESTAMP(3) + INTERVAL 10 MINUTE
     FROM members WHERE public_id = ?`,
    [hashToken(token), provider, publicId],
  );
  if (result.affectedRows !== 1) throw new Error("Compte introuvable.");
  return token;
}

export async function consumeOAuthLinkIntent(
  connection: PoolConnection,
  token: string,
  provider: string,
  accountId: string,
): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT m.id AS memberId, m.public_id AS publicId
       FROM member_oauth_link_intents i
       JOIN members m ON m.id = i.member_id
       WHERE i.token_hash = ? AND i.provider = ?
         AND i.expires_at > UTC_TIMESTAMP(3)
       FOR UPDATE`,
      [hashToken(token), provider],
    );
    const target = rows[0];
    if (!target) {
      await connection.commit();
      return null;
    }
    const [existing] = await connection.execute<MemberRow[]>(
      `SELECT member_id AS memberId FROM member_oauth_accounts
       WHERE provider = ? AND provider_account_id = ?`,
      [provider, accountId],
    );
    if (existing[0] && existing[0].memberId !== target.memberId) {
      throw new Error("Ce compte externe appartient déjà à un autre membre.");
    }
    if (!existing[0]) {
      await connection.execute(
        `INSERT INTO member_oauth_accounts
           (provider, provider_account_id, member_id) VALUES (?, ?, ?)`,
        [provider, accountId, target.memberId!],
      );
    }
    await connection.execute(
      "DELETE FROM member_oauth_link_intents WHERE token_hash = ?",
      [hashToken(token)],
    );
    await connection.commit();
    return target.publicId;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function completeOAuthOnboarding(
  connection: PoolConnection,
  publicId: string,
  legalName: string,
  requestedHandle: string | null,
): Promise<string> {
  const name = legalNameOf(legalName);
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT m.id AS memberId
       FROM members m
       JOIN member_oauth_accounts a ON a.member_id = m.id
       WHERE m.public_id = ? LIMIT 1 FOR UPDATE`,
      [publicId],
    );
    const memberId = rows[0]?.memberId;
    if (!memberId) throw new Error("Inscription OAuth indisponible.");
    const handle = await chooseHandle(connection, requestedHandle);
    await connection.execute(
      "INSERT INTO member_private_identities (member_id, legal_name) VALUES (?, ?)",
      [memberId, name],
    );
    await connection.execute(
      `INSERT INTO member_profiles
         (member_id, handle, created_at, updated_at)
       VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [memberId, handle],
    );
    await connection.commit();
    return handle;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function authenticateEmail(
  connection: PoolConnection,
  rawEmail: string,
  password: string,
): Promise<string | null> {
  let email: string;
  try {
    email = emailOf(rawEmail);
  } catch {
    return null;
  }
  const [rows] = await connection.execute<MemberRow[]>(
    `SELECT m.public_id AS publicId,
            c.password_hash AS passwordHash,
            c.verified_at AS verifiedAt
     FROM member_email_credentials c
     JOIN members m ON m.id = c.member_id
     WHERE c.email = ?`,
    [email],
  );
  if (!rows[0]?.verifiedAt || !rows[0].passwordHash) return null;
  return await verifyPassword(password, rows[0].passwordHash)
    ? rows[0].publicId : null;
}

export async function issueEmailToken(
  connection: PoolConnection,
  rawEmail: string,
  purpose: "verify" | "reset",
): Promise<{ email: string; token: string } | null> {
  const email = emailOf(rawEmail);
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT member_id AS memberId, email, verified_at AS verifiedAt
       FROM member_email_credentials
       WHERE email = ? FOR UPDATE`,
      [email],
    );
    const record = rows[0];
    if (!record ||
        (purpose === "verify" && record.verifiedAt) ||
        (purpose === "reset" && !record.verifiedAt)) {
      await connection.commit();
      return null;
    }
    const token = await replaceToken(
      connection, record.memberId!, purpose,
      purpose === "verify" ? 60 : 30,
    );
    await connection.commit();
    return { email, token };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function consumeEmailToken(
  connection: PoolConnection,
  token: string,
  purpose: "verify" | "reset",
  newPassword?: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const passwordHash = purpose === "reset"
    ? await hashPassword(newPassword ?? "") : null;
  await connection.beginTransaction();
  try {
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT member_id AS memberId
       FROM member_auth_tokens
       WHERE token_hash = ? AND purpose = ?
         AND expires_at > UTC_TIMESTAMP(3)
       FOR UPDATE`,
      [hashToken(token), purpose],
    );
    if (!rows[0]?.memberId) {
      await connection.commit();
      return false;
    }
    const memberId = rows[0].memberId;
    if (purpose === "verify") {
      await connection.execute(
        `UPDATE member_email_credentials
         SET verified_at = UTC_TIMESTAMP(3)
         WHERE member_id = ? AND verified_at IS NULL`,
        [memberId],
      );
    } else {
      await connection.execute(
        `UPDATE member_email_credentials
         SET password_hash = ? WHERE member_id = ?`,
        [passwordHash, memberId],
      );
      await connection.execute(
        "DELETE FROM member_sessions WHERE member_id = ?",
        [memberId],
      );
    }
    await connection.execute(
      "DELETE FROM member_auth_tokens WHERE token_hash = ?",
      [hashToken(token)],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function allowAuthAttempt(
  connection: PoolConnection,
  category: string,
  identifier: string,
  limit = 10,
): Promise<boolean> {
  const key = hashToken(`${category}:${identifier.toLowerCase()}`);
  await connection.execute(
    `INSERT INTO member_auth_limits (key_hash, attempts, reset_at)
     VALUES (?, 1, UTC_TIMESTAMP(3) + INTERVAL 15 MINUTE)
     ON DUPLICATE KEY UPDATE
       attempts = IF(reset_at <= UTC_TIMESTAMP(3), 1, attempts + 1),
       reset_at = IF(reset_at <= UTC_TIMESTAMP(3),
         UTC_TIMESTAMP(3) + INTERVAL 15 MINUTE, reset_at)`,
    [key],
  );
  const [rows] = await connection.execute<
    (RowDataPacket & { attempts: number })[]
  >("SELECT attempts FROM member_auth_limits WHERE key_hash = ?", [key]);
  return rows[0].attempts <= limit;
}
