import { Schema, model } from "mongoose";

const refreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  tokenHash: { type: String, required: true, unique: true },
  // Rotation lineage: a reused (already-rotated) token revokes its whole family.
  family: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

// TTL index: expired refresh tokens are reaped automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
