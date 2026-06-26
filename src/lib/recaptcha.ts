import { env } from "../config/env.js";
import { badRequest } from "./errors.js";
import { logger } from "./logger.js";

const DEFAULT_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const TIMEOUT_MS = 5000;

/** Subset of Google's siteverify response we rely on. */
type SiteVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export type CaptchaAssessment =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

/**
 * Pure assessment core: given an explicit secret/threshold and an injectable
 * `fetchImpl`, decide whether a token passes. It reads no env and touches no
 * globals, so it is unit-testable without network or process state.
 *
 * Posture (see docs/security.md): a *definitive* negative (missing token, failed
 * verification, action mismatch, or score below `minScore`) fails closed
 * (`ok:false`). An *infrastructure* error (timeout, non-200, unparseable body)
 * fails OPEN (`ok:true, skipped:true`) — the CAPTCHA is a supplementary layer on
 * top of the per-IP limiter and per-account lockout, so a provider outage must
 * not take down registration entirely.
 */
export async function assessCaptcha(opts: {
  secret: string;
  minScore: number;
  token: string | undefined;
  action: string;
  remoteIp?: string;
  verifyUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<CaptchaAssessment> {
  const { secret, minScore, token, action, remoteIp } = opts;
  const doFetch = opts.fetchImpl ?? fetch;
  const verifyUrl = opts.verifyUrl ?? DEFAULT_VERIFY_URL;
  if (!token) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let data: SiteVerifyResponse;
  try {
    const res = await doFetch(verifyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "recaptcha siteverify non-200");
      return { ok: true, skipped: true };
    }
    data = (await res.json()) as SiteVerifyResponse;
  } catch (err: unknown) {
    logger.warn({ err }, "recaptcha siteverify unreachable");
    return { ok: true, skipped: true };
  }

  if (!data.success) return { ok: false, reason: "verification-failed" };
  if (data.action && action && data.action !== action) {
    return { ok: false, reason: "action-mismatch" };
  }
  if (typeof data.score === "number" && data.score < minScore) {
    return { ok: false, reason: "low-score" };
  }
  return { ok: true, skipped: false };
}

/**
 * Enforce the CAPTCHA at a controller boundary. A no-op while `RECAPTCHA_SECRET`
 * is unset. On a definitive failure it throws `badRequest("CAPTCHA_FAILED")`;
 * infrastructure errors fail open (see `assessCaptcha`). `action` must match the
 * `grecaptcha.execute(..., { action })` the client used (`register` /
 * `forgot_password`).
 */
export async function requireCaptcha(
  token: string | undefined,
  action: string,
  remoteIp?: string,
): Promise<void> {
  if (!env.RECAPTCHA_SECRET) return;
  const result = await assessCaptcha({
    secret: env.RECAPTCHA_SECRET,
    minScore: env.RECAPTCHA_MIN_SCORE,
    verifyUrl: env.RECAPTCHA_VERIFY_URL,
    token,
    action,
    remoteIp,
  });
  if (!result.ok) {
    logger.warn({ action, reason: result.reason }, "captcha rejected");
    throw badRequest("CAPTCHA_FAILED", "CAPTCHA verification failed");
  }
}
