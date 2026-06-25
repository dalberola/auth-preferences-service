import { AppDataSource } from "../../db/data-source.js";
import { User } from "../../models/user.js";
import { RefreshToken } from "../../models/refreshToken.js";
import { VerificationToken } from "../../models/verificationToken.js";

/**
 * Permanently delete a user and everything keyed to them. The token tables
 * reference `User.id` through a plain `userId` column (no DB-level cascade), so
 * the children are removed explicitly. Done in one transaction so an account is
 * never left half-deleted.
 *
 * Idempotent: deleting an account that no longer exists simply affects 0 rows.
 * The access JWT is stateless, so a client holding a still-valid token can call
 * this twice (e.g. a double click) and both calls succeed.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await AppDataSource.transaction(async (manager) => {
    await manager.getRepository(RefreshToken).delete({ userId });
    await manager.getRepository(VerificationToken).delete({ userId });
    await manager.getRepository(User).delete({ id: userId });
  });
}
