import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import {
  loginSchema,
  registerSchema,
  resendSchema,
  verifyQuerySchema,
} from "./validators.js";
import * as auth from "./service.js";

const REFRESH_COOKIE = "refresh_token";

function refreshCookieOptions(expires: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
    expires,
  };
}

function setRefreshCookie(res: Response, token: string, expires: Date): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(expires));
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  await auth.register(input);
  // Generic response regardless of whether the email already existed.
  res.status(202).json({
    message: "If the email is valid, a verification link has been sent.",
  });
}

export async function verify(req: Request, res: Response): Promise<void> {
  const { token } = verifyQuerySchema.parse(req.query);
  await auth.verifyEmail(token);
  res.redirect(`${env.CLIENT_URL}/?verified=1`);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const tokens = await auth.login(input);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json({ accessToken: tokens.accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const current = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!current) {
    res.status(401).json({
      error: { code: "NO_TOKEN", message: "Missing refresh token" },
    });
    return;
  }
  const tokens = await auth.refresh(current);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json({ accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const current = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await auth.logout(current);
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  res.status(204).end();
}

export async function resendVerification(
  req: Request,
  res: Response,
): Promise<void> {
  const { email } = resendSchema.parse(req.body);
  await auth.resendVerification(email);
  res.status(202).json({
    message: "If the email is valid and unverified, a new link has been sent.",
  });
}
