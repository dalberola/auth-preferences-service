import { Schema, model, type InferSchemaType } from "mongoose";

const preferencesSchema = new Schema(
  {
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    locale: { type: String, default: "en" },
    schemaVersion: { type: Number, default: 1 },
    // Free-form bag for app-specific settings; validated at the API boundary.
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, required: true, default: false },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
