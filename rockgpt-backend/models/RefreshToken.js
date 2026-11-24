import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 3600, // 30-day automatic MongoDB TTL expiration
    },
  },
  { timestamps: true }
);

const RefreshToken =
  mongoose.models.RefreshToken || mongoose.model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
