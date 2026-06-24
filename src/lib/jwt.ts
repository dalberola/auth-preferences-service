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

/** Returns the user id encoded in `sub`, or throws if invalid/expired. */
export function verifyAccessToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
  });
  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Malformed access token");
  }
  return payload.sub;
}
