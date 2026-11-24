import mongoose from "mongoose";

const otpRateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true, // "email:..." or "ip:..."
    },
    count: {
      type: Number,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 3600 * 1000),
      index: { expires: 0 }, // 1-hour rolling window TTL
    },
  },
  { timestamps: true }
);

const OtpRateLimit =
  mongoose.models.OtpRateLimit || mongoose.model("OtpRateLimit", otpRateLimitSchema);

export default OtpRateLimit;
