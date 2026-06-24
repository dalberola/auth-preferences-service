import { env } from "../../config/env.js";
import { User } from "../../models/user.js";
import { VerificationToken } from "../../models/verificationToken.js";
import { RefreshToken } from "../../models/refreshToken.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generateToken, hashToken, newId } from "../../lib/tokens.js";
import { signAccessToken } from "../../lib/jwt.js";
import { sendVerificationEmail } from "../../lib/mailer.js";
import { forbidden, unauthorized } from "../../lib/errors.js";
import type { LoginInput, RegisterInput } from "./validators.js";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = () => env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

async function issueVerification(
  userId: string,
  email: string,
): Promise<void> {
  const { raw, hash } = generateToken();
  await VerificationToken.create({
    userId,
    tokenHash: hash,
    type: "email_verify",
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  });
  await sendVerificationEmail(email, raw);
}

/**
 * Register a new account. Always resolves the same way (the controller returns a
 * generic 202) so the endpoint does not reveal whether an email is registered.
 */
export async function register(input: RegisterInput): Promise<void> {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });

  if (!existing) {
    const passwordHash = await hashPassword(input.password);
    const user = await User.create({ email, passwordHash });
    await issueVerification(user.id, email);
    return;
  }

  // Resend for an account that exists but never verified; verified accounts no-op.
  if (!existing.emailVerified) {
    await issueVerification(existing.id, email);
  }
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await VerificationToken.findOne({
    tokenHash,
    type: "email_verify",
    consumedAt: null,
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("INVALID_TOKEN", "Invalid or expired verification link");
  }

  await User.updateOne(
    { _id: record.userId },
    { $set: { emailVerified: true } },
  );
  record.consumedAt = new Date();
  await record.save();
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
  await RefreshToken.create({ userId, tokenHash: hash, family, expiresAt });
  return { raw, expiresAt };
}

export async function login(input: LoginInput): Promise<IssuedTokens> {
  const email = input.email.toLowerCase();
  const user = await User.findOne({ email });
  const ok = user && (await verifyPassword(user.passwordHash, input.password));

  if (!user || !ok) {
    throw unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }
  if (!user.emailVerified) {
    throw forbidden("EMAIL_NOT_VERIFIED", "Email address is not verified");
  }

  const refresh = await issueRefreshToken(user.id, newId());
  return {
    accessToken: signAccessToken(user.id),
    refreshToken: refresh.raw,
    refreshExpiresAt: refresh.expiresAt,
  };
}

export async function refresh(rawToken: string): Promise<IssuedTokens> {
  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ tokenHash });

  if (!record) {
    throw unauthorized("INVALID_TOKEN", "Invalid refresh token");
  }

  // Reuse of an already-rotated token => compromise. Burn the whole family.
  if (record.revokedAt) {
    await RefreshToken.updateMany(
      { family: record.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw unauthorized("TOKEN_REUSE", "Refresh token reuse detected");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("INVALID_TOKEN", "Refresh token expired");
  }

  const userId = record.userId.toString();
  const next = await issueRefreshToken(userId, record.family);
  record.revokedAt = new Date();
  record.replacedByHash = hashToken(next.raw);
  await record.save();

  return {
    accessToken: signAccessToken(userId),
    refreshToken: next.raw,
    refreshExpiresAt: next.expiresAt,
  };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function resendVerification(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase();
  const user = await User.findOne({ email });
  if (user && !user.emailVerified) {
    await issueVerification(user.id, email);
  }
}
