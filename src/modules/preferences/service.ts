import { AppDataSource } from "../../db/data-source.js";
import { User, defaultPreferences } from "../../models/user.js";
import { unauthorized } from "../../lib/errors.js";
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
  if (patch.theme !== undefined) preferences.theme = patch.theme;
  if (patch.locale !== undefined) preferences.locale = patch.locale;
  if (patch.settings !== undefined) preferences.settings = patch.settings;

  user.preferences = preferences;
  await repo.save(user);
  return user.preferences;
}
