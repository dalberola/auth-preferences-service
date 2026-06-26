import { IsNull } from "typeorm";
import { env } from "../../config/env.js";
import { AppDataSource } from "../../db/data-source.js";
import { User, defaultPreferences } from "../../models/user.js";
import { VerificationToken } from "../../models/verificationToken.js";
import { RefreshToken } from "../../models/refreshToken.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generateToken, hashToken, newId } from "../../lib/tokens.js";
import { signAccessToken } from "../../lib/jwt.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../lib/mailer.js";
import { forbidden, unauthorized } from "../../lib/errors.js";
import { CONSENT_VERSION } from "./consent.js";
import type { LoginInput, RegisterInput } from "./validators.js";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = () => env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

const users = () => AppDataSource.getRepository(User);
const verifications = () => AppDataSource.getRepository(VerificationToken);
const refreshTokens = () => AppDataSource.getRepository(RefreshToken);

// Precomputed once at startup. Login verifies against this when no account exists,
// so the no-user path still pays the argon2 cost and its response time doesn't
// reveal whether an email is registered (timing-based enumeration).
const dummyPasswordHash = hashPassword(newId());

async function issueVerification(
  userId: string,
  email: string,
): Promise<void> {
  const { raw, hash } = generateToken();
  const repo = verifications();
  await repo.save(
    repo.create({
      userId,
      tokenHash: hash,
      type: "email_verify",
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    }),
  );
  await sendVerificationEmail(email, raw);
}

/**
 * Register a new account. Always resolves the same way (the controller returns a
 * generic 202) so the endpoint does not reveal whether an email is registered.
 */
export async function register(input: RegisterInput): Promise<void> {
  const email = input.email.toLowerCase();
  const repo = users();
  const existing = await repo.findOne({ where: { email } });

  // Record which legal-terms version was accepted (client-reported, else the
  // server's current version) and when — proof of consent (GDPR).
  const consentVersion = input.consentVersion ?? CONSENT_VERSION;
  const consentAt = new Date();

  if (!existing) {
    const passwordHash = await hashPassword(input.password);
    const user = await repo.save(
      repo.create({
        email,
        passwordHash,
        preferences: defaultPreferences(),
        consentVersion,
        consentAt,
        lastActiveAt: consentAt,
      }),
    );
    await issueVerification(user.id, email);
    return;
  }

  // Resend for an account that exists but never verified; verified accounts no-op.
  if (!existing.emailVerified) {
    // The user re-accepted the terms on this submission — record the latest.
    await repo.update(existing.id, { consentVersion, consentAt });
    await issueVerification(existing.id, email);
  }
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const repo = verifications();
  const record = await repo.findOne({
    where: { tokenHash, type: "email_verify", consumedAt: IsNull() },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("INVALID_TOKEN", "Invalid or expired verification link");
  }

  await users().update(record.userId, { emailVerified: true });
  record.consumedAt = new Date();
  await repo.save(record);
}

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

async function issueRefreshToken(
  userId: string,
  family: string,
): Promise<{ raw: string; expiresAt: Date }> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS());
  const repo = refreshTokens();
  await repo.save(repo.create({ userId, tokenHash: hash, family, expiresAt }));
  return { raw, expiresAt };
}

function isLocked(user: User): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
}

/**
 * Record a failed login. A lock whose window has already passed resets the count
 * (fresh start); otherwise failures accumulate and crossing the threshold sets a
 * fresh lock window.
 */
async function recordFailedLogin(user: User): Promise<void> {
  const lockExpired =
    user.lockedUntil !== null && user.lockedUntil.getTime() <= Date.now();
  const attempts = (lockExpired ? 0 : user.failedLoginAttempts) + 1;
  const locked = attempts >= env.LOGIN_MAX_ATTEMPTS;
  await users().update(user.id, {
    failedLoginAttempts: attempts,
    lockedUntil: locked
      ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60_000)
      : null,
  });
}

export async function login(input: LoginInput): Promise<IssuedTokens> {
  const email = input.email.toLowerCase();
  const user = await users().findOne({ where: { email } });

  // An active lock fails closed with the same generic error as bad credentials,
  // so it reveals neither that the account exists nor that it is locked.
  if (user && isLocked(user)) {
    throw unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }

  // Always run argon2 — against the dummy hash when no account exists — so the
  // response time is the same whether or not the email is registered.
  const ok = await verifyPassword(
    user?.passwordHash ?? (await dummyPasswordHash),
    input.password,
  );

  if (!user || !ok) {
    if (user) await recordFailedLogin(user);
    throw unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }

  // Correct credentials clear any accumulated failures / expired lock.
  if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
    await users().update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
  }

  if (!user.emailVerified) {
    throw forbidden("EMAIL_NOT_VERIFIED", "Email address is not verified");
  }

  // A completed sign-in counts as activity; clear any pending inactivity warning.
  await users().update(user.id, {
    lastActiveAt: new Date(),
    inactivityWarnedAt: null,
  });

  const refresh = await issueRefreshToken(user.id, newId());
  return {
    accessToken: signAccessToken(user.id),
    refreshToken: refresh.raw,
    refreshExpiresAt: refresh.expiresAt,
  };
}

export async function refresh(rawToken: string): Promise<IssuedTokens> {
  const tokenHash = hashToken(rawToken);
  const repo = refreshTokens();
  const record = await repo.findOne({ where: { tokenHash } });

  if (!record) {
    throw unauthorized("INVALID_TOKEN", "Invalid refresh token");
  }

  // Reuse of an already-rotated token => compromise. Burn the whole family.
  if (record.revokedAt) {
    await repo.update(
      { family: record.family, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    throw unauthorized("TOKEN_REUSE", "Refresh token reuse detected");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("INVALID_TOKEN", "Refresh token expired");
  }

  const userId = record.userId;
  // A silent refresh is the primary activity signal for logged-in users, who
  // rarely re-login; without this, active accounts would be purged as inactive.
  await users().update(userId, {
    lastActiveAt: new Date(),
    inactivityWarnedAt: null,
  });
  const next = await issueRefreshToken(userId, record.family);
  record.revokedAt = new Date();
  record.replacedByHash = hashToken(next.raw);
  await repo.save(record);

  return {
    accessToken: signAccessToken(userId),
    refreshToken: next.raw,
    refreshExpiresAt: next.expiresAt,
  };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await refreshTokens().update(
    { tokenHash: hashToken(rawToken), revokedAt: IsNull() },
    { revokedAt: new Date() },
  );
}

export async function resendVerification(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase();
  const user = await users().findOne({ where: { email } });
  if (user && !user.emailVerified) {
    await issueVerification(user.id, email);
  }
}

/**
 * Issue a password-reset token and email it. Always resolves the same way (the
 * controller returns a generic 202) so it never reveals whether an email exists.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase();
  const user = await users().findOne({ where: { email } });
  if (!user) return;

  const { raw, hash } = generateToken();
  const repo = verifications();
  await repo.save(
    repo.create({
      userId: user.id,
      tokenHash: hash,
      type: "password_reset",
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    }),
  );
  await sendPasswordResetEmail(email, raw);
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const repo = verifications();
  const record = await repo.findOne({
    where: { tokenHash, type: "password_reset", consumedAt: IsNull() },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("INVALID_TOKEN", "Invalid or expired reset link");
  }

  const passwordHash = await hashPassword(newPassword);
  await users().update(record.userId, { passwordHash });

  record.consumedAt = new Date();
  await repo.save(record);

  // A reset implies possible compromise: revoke every outstanding session.
  await refreshTokens().update(
    { userId: record.userId, revokedAt: IsNull() },
    { revokedAt: new Date() },
  );
}
