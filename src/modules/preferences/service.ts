import { User } from "../../models/user.js";
import { unauthorized } from "../../lib/errors.js";
import type { PreferencesInput } from "./validators.js";

export async function getPreferences(userId: string) {
  const user = await User.findById(userId).select("preferences");
  if (!user) {
    throw unauthorized("USER_NOT_FOUND", "Account no longer exists");
  }
  return user.preferences;
}

export async function updatePreferences(
  userId: string,
  patch: PreferencesInput,
) {
  // Build a dotted $set so only the provided keys are touched (partial update).
  const update: Record<string, unknown> = {};
  if (patch.theme !== undefined) update["preferences.theme"] = patch.theme;
  if (patch.locale !== undefined) update["preferences.locale"] = patch.locale;
  if (patch.settings !== undefined) {
    update["preferences.settings"] = patch.settings;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { returnDocument: "after", select: "preferences" },
  );
  if (!user) {
    throw unauthorized("USER_NOT_FOUND", "Account no longer exists");
  }
  return user.preferences;
}
