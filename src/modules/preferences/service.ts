import { AppDataSource } from "../../db/data-source.js";
import { User, defaultPreferences } from "../../models/user.js";
import { conflict, unauthorized } from "../../lib/errors.js";
import type { PreferencesInput } from "./validators.js";

const users = () => AppDataSource.getRepository(User);

export async function getPreferences(userId: string) {
  const user = await users().findOne({
    where: { id: userId },
    select: { id: true, preferences: true },
  });
  if (!user) {
    throw unauthorized("USER_NOT_FOUND", "Account no longer exists");
  }
  return user.preferences;
}

export async function updatePreferences(
  userId: string,
  patch: PreferencesInput,
) {
  const repo = users();
  const user = await repo.findOne({ where: { id: userId } });
  if (!user) {
    throw unauthorized("USER_NOT_FOUND", "Account no longer exists");
  }

  // Read-merge-save: only the provided keys are touched (partial update). The
  // JSON column is rewritten as a whole, which is fine at this scale.
  const preferences = user.preferences ?? defaultPreferences();

  // Optimistic concurrency for the settings blob. A sync-aware client stamps the
  // edit time it is writing; reject when the stored config is strictly newer so a
  // stale device cannot overwrite a newer one. The client resolves a 409 by
  // pulling the current config (last-writer-by-edit-time wins). Writes that omit
  // `updatedAt` (theme/locale-only, or pre-sync clients) skip the check and leave
  // the clock untouched.
  const stored = preferences.updatedAt ?? 0;
  if (patch.updatedAt !== undefined && patch.updatedAt < stored) {
    throw conflict(
      "PREFERENCES_CONFLICT",
      "A newer configuration exists; pull the latest before writing.",
    );
  }

  if (patch.theme !== undefined) preferences.theme = patch.theme;
  if (patch.locale !== undefined) preferences.locale = patch.locale;
  if (patch.settings !== undefined) preferences.settings = patch.settings;
  if (patch.updatedAt !== undefined) preferences.updatedAt = patch.updatedAt;

  user.preferences = preferences;
  await repo.save(user);
  return user.preferences;
}
