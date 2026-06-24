import { z } from "zod";

export const preferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    locale: z.string().min(2).max(10).optional(),
    // App-specific settings: arbitrary keys, JSON-serialisable values.
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type PreferencesInput = z.infer<typeof preferencesSchema>;
