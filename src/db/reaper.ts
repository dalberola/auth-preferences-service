import { LessThan } from "typeorm";
import { AppDataSource } from "./data-source.js";
import { RefreshToken } from "../models/refreshToken.js";
import { VerificationToken } from "../models/verificationToken.js";
import { logger } from "../lib/logger.js";

export type ReapResult = {
  refreshTokens: number;
  verificationTokens: number;
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
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
