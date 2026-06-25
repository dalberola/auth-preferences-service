import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

const ACCESS_OPTIONS: SignOptions = {
  algorithm: "HS256",
  expiresIn: env.ACCESS_TTL as SignOptions["expiresIn"],
};

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    ...ACCESS_OPTIONS,
    subject: userId,
  });
}

// Current secret first, then the previous one during a rotation overlap. Tokens are
// only ever signed with the current secret; the previous is accepted on verify so a
// rotation doesn't invalidate live tokens.
function accessSecrets(): string[] {
  return env.JWT_ACCESS_SECRET_PREVIOUS
    ? [env.JWT_ACCESS_SECRET, env.JWT_ACCESS_SECRET_PREVIOUS]
    : [env.JWT_ACCESS_SECRET];
}

function subjectFor(token: string, secret: string): string | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Returns the user id encoded in `sub`, or throws if invalid/expired. */
export function verifyAccessToken(token: string): string {
  for (const secret of accessSecrets()) {
    const sub = subjectFor(token, secret);
    if (sub) return sub;
  }
  throw new Error("Invalid or expired access token");
}
