import { Between, In, IsNull, LessThan } from "typeorm";
import { AppDataSource } from "./data-source.js";
import { User } from "../models/user.js";
import { RefreshToken } from "../models/refreshToken.js";
import { VerificationToken } from "../models/verificationToken.js";
import { env } from "../config/env.js";
import { sendInactivityWarningEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";

export type ReapResult = {
  refreshTokens: number;
  verificationTokens: number;
};

export type InactivityResult = {
  warned: number;
  deleted: number;
};

/**
 * Delete tokens whose `expiresAt` has passed. This replaces MongoDB's TTL index.
 *
 * Reaping is keyed on expiry ONLY — revoked-but-unexpired refresh tokens are kept
 * deliberately, so a replay is still recognised as reuse and burns its family
 * (deleting them early would downgrade reuse detection to a plain invalid-token).
 */
export async function reapExpiredTokens(now: Date = new Date()): Promise<ReapResult> {
  const refresh = await AppDataSource.getRepository(RefreshToken).delete({
    expiresAt: LessThan(now),
  });
  const verification = await AppDataSource.getRepository(VerificationToken).delete({
    expiresAt: LessThan(now),
  });
  return {
    refreshTokens: refresh.affected ?? 0,
    verificationTokens: verification.affected ?? 0,
  };
}

/**
 * Enforce the inactivity policy (Privacy Policy): warn accounts approaching the
 * cutoff, then permanently delete those past it.
 *
 * Two disjoint, complete windows keyed on `lastActiveAt`:
 *   - [deleteCutoff, warnCutoff]  → warn once (gated by `inactivityWarnedAt`)
 *   - (-∞, deleteCutoff)          → delete, cascading the account's tokens
 * `lastActiveAt IS NULL` is excluded from both comparisons, so an account with
 * no recorded activity is never warned or purged.
 */
export async function purgeInactiveAccounts(
  now: Date = new Date(),
): Promise<InactivityResult> {
  const users = AppDataSource.getRepository(User);

  const deleteCutoff = new Date(now);
  deleteCutoff.setMonth(deleteCutoff.getMonth() - env.INACTIVITY_PURGE_MONTHS);
  const warnCutoff = new Date(deleteCutoff);
  warnCutoff.setDate(warnCutoff.getDate() + env.INACTIVITY_WARNING_DAYS);

  // 1. Warn accounts that have entered the danger zone and weren't warned yet.
  const toWarn = await users.find({
    where: {
      lastActiveAt: Between(deleteCutoff, warnCutoff),
      inactivityWarnedAt: IsNull(),
    },
    select: { id: true, email: true, lastActiveAt: true },
  });
  let warned = 0;
  for (const u of toWarn) {
    const deletionAt = new Date(u.lastActiveAt!);
    deletionAt.setMonth(deletionAt.getMonth() + env.INACTIVITY_PURGE_MONTHS);
    const days = Math.max(
      0,
      Math.ceil((deletionAt.getTime() - now.getTime()) / 86_400_000),
    );
    try {
      await sendInactivityWarningEmail(u.email, days);
      await users.update(u.id, { inactivityWarnedAt: now });
      warned++;
    } catch (err: unknown) {
      // One bad address must not stall the rest of the sweep.
      logger.warn({ err, userId: u.id }, "inactivity warning email failed");
    }
  }

  // 2. Delete accounts past the cutoff, cascading their tokens (the FK columns
  // are a plain `userId`, so children are removed explicitly, all in one txn).
  const stale = await users.find({
    where: { lastActiveAt: LessThan(deleteCutoff) },
    select: { id: true },
  });
  let deleted = 0;
  if (stale.length > 0) {
    const ids = stale.map((u) => u.id);
    await AppDataSource.transaction(async (manager) => {
      await manager.delete(RefreshToken, { userId: In(ids) });
      await manager.delete(VerificationToken, { userId: In(ids) });
      const res = await manager.delete(User, { id: In(ids) });
      deleted = res.affected ?? ids.length;
    });
  }

  return { warned, deleted };
}

/**
 * Run the reaper once immediately, then every `intervalMs`. Failures are logged,
 * never thrown — a transient DB hiccup must not crash the process. The timer is
 * unref'd so it doesn't keep the event loop alive on its own.
 */
export function startTokenReaper(intervalMs: number): { stop: () => void } {
  const tick = (): void => {
    reapExpiredTokens()
      .then(({ refreshTokens, verificationTokens }) => {
        if (refreshTokens || verificationTokens) {
          logger.info(
            { refreshTokens, verificationTokens },
            "reaped expired tokens",
          );
        }
      })
      .catch((err: unknown) => logger.warn({ err }, "token reap failed"));

    purgeInactiveAccounts()
      .then(({ warned, deleted }) => {
        if (warned || deleted) {
          logger.info({ warned, deleted }, "inactivity sweep");
        }
      })
      .catch((err: unknown) => logger.warn({ err }, "inactivity purge failed"));
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
