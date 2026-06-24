import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendSchema,
  resetPasswordSchema,
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

// Switch point for the refresh-token transport (see docs/security.md). In
// `cookie` mode it rides an httpOnly cookie; in `body` mode it travels in the
// JSON body so cross-origin / extension clients can store it themselves.
function deliverSession(res: Response, tokens: auth.IssuedTokens): void {
  if (env.REFRESH_TOKEN_TRANSPORT === "cookie") {
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    res.json({ accessToken: tokens.accessToken });
    return;
  }
  res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });
}

function readRefreshToken(req: Request): string | undefined {
  if (env.REFRESH_TOKEN_TRANSPORT === "cookie") {
    return req.cookies?.[REFRESH_COOKIE] as string | undefined;
  }
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)
    ?.refreshToken;
  return typeof fromBody === "string" ? fromBody : undefined;
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
  deliverSession(res, tokens);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const current = readRefreshToken(req);
  if (!current) {
    res.status(401).json({
      error: { code: "NO_TOKEN", message: "Missing refresh token" },
    });
    return;
  }
  const tokens = await auth.refresh(current);
  deliverSession(res, tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const current = readRefreshToken(req);
  await auth.logout(current);
  if (env.REFRESH_TOKEN_TRANSPORT === "cookie") {
    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  }
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

export async function forgotPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  await auth.requestPasswordReset(email);
  // Generic response regardless of whether the email exists.
  res.status(202).json({
    message: "If the email is valid, a password reset link has been sent.",
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await auth.resetPassword(token, password);
  res.status(204).end();
}
