import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
const cost = 1 << 15;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, {
      N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
    }, (error, key) => error ? reject(error) : resolve(key));
  });
}

export function validatePassword(password: string): void {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 256
  ) {
    throw new TypeError("Mot de passe invalide (12 à 256 octets).");
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt-v1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (
    parts.length !== 3 || parts[0] !== "scrypt-v1" ||
    !/^[0-9a-f]{32}$/.test(parts[1]) ||
    !/^[0-9a-f]{128}$/.test(parts[2])
  ) return false;
  const expected = Buffer.from(parts[2], "hex");
  const actual = await scrypt(password, Buffer.from(parts[1], "hex"));
  return timingSafeEqual(actual, expected);
}
