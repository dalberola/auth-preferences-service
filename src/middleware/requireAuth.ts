import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/errors.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("NO_TOKEN", "Missing bearer token");
  }
  try {
    req.userId = verifyAccessToken(header.slice("Bearer ".length).trim());
    next();
  } catch {
    throw unauthorized("INVALID_TOKEN", "Invalid or expired access token");
  }
};
