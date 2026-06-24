import { createHash, randomBytes, randomUUID } from "node:crypto";

/** A high-entropy opaque token: `raw` goes to the user, `hash` is persisted. */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

/** Deterministic hash for lookup. Tokens are high-entropy, so SHA-256 is sufficient. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newId(): string {
  return randomUUID();
}
