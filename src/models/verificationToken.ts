import { Schema, model } from "mongoose";

const verificationTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  tokenHash: { type: String, required: true, unique: true },
  type: { type: String, enum: ["email_verify"], required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

// TTL index: Mongo removes documents once `expiresAt` passes.
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationToken = model(
  "VerificationToken",
  verificationTokenSchema,
);
