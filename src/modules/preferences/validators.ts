import { z } from "zod";

export const preferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    locale: z.string().min(2).max(10).optional(),
    // App-specific settings: arbitrary keys, JSON-serialisable values.
    settings: z.record(z.string(), z.unknown()).optional(),
    // Optimistic-concurrency clock (epoch-ms): the edit time the client is
    // writing. Omitted by clients that predate cross-device sync; when present,
    // a value older than the stored one is rejected with 409.
    updatedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

export type PreferencesInput = z.infer<typeof preferencesSchema>;
