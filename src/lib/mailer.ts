import { createTransport, type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

function buildTransport(): Transporter {
  // Tests never touch the network: jsonTransport just serialises the message.
  if (env.NODE_ENV === "test") {
    return createTransport({ jsonTransport: true });
  }
  return createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
}

const transport = buildTransport();

export async function sendVerificationEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const link = `${env.APP_URL}/auth/verify?token=${rawToken}`;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: "Verify your email address",
    text: `Welcome! Confirm your email by opening this link:\n\n${link}\n\nThis link expires in 24 hours.`,
    html:
      `<p>Welcome! Confirm your email by clicking the link below:</p>` +
      `<p><a href="${link}">Verify my email</a></p>` +
      `<p>This link expires in 24 hours.</p>`,
  });
  logger.info({ to }, "verification email dispatched");
}

export async function sendInactivityWarningEmail(
  to: string,
  daysUntilDeletion: number,
): Promise<void> {
  // Signing in (anywhere in the consumer app) refreshes `lastActiveAt` and
  // cancels the pending deletion.
  const link = env.CLIENT_URL;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: "Your account will be deleted soon",
    text:
      `Your account has been inactive for a while and is scheduled for ` +
      `deletion in about ${daysUntilDeletion} days.\n\n` +
      `Sign in to keep it:\n\n${link}\n\n` +
      `If you do nothing, your account and synced settings will be permanently deleted.`,
    html:
      `<p>Your account has been inactive for a while and is scheduled for ` +
      `deletion in about ${daysUntilDeletion} days.</p>` +
      `<p><a href="${link}">Sign in to keep your account</a></p>` +
      `<p>If you do nothing, your account and synced settings will be permanently deleted.</p>`,
  });
  logger.info({ to }, "inactivity warning email dispatched");
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  // The client collects the new password and POSTs it to /auth/reset-password.
  const link = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: "Reset your password",
    text: `Reset your password by opening this link:\n\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    html:
      `<p>Reset your password by clicking the link below:</p>` +
      `<p><a href="${link}">Reset my password</a></p>` +
      `<p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
  });
  logger.info({ to }, "password reset email dispatched");
}
