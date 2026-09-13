import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String }, // Optional for Google OAuth users
  googleId: { type: String, sparse: true },
  avatar: { type: String },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  securityLogs: [
    {
      action: { type: String },
      ip: { type: String },
      userAgent: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  lastLoginAt: { type: Date },
  plan: { type: String, default: "Free" },
  planExpiresAt: { type: Date },
  razorpayPaymentId: { type: String },
  razorpayOrderId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);