import mongoose from "mongoose";

const otpVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Cryptographic HMAC-SHA256 hash bound to (email:purpose:code)
    codeHash: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["signup", "reset", "login"],
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    passwordHash: {
      type: String,
      default: "",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // 10 minutes TTL in MongoDB
    },
    // Populated strictly during automated unit tests in test environment
    testPlainCode: {
      type: String,
      default: null,
      select: process.env.NODE_ENV === "test",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

otpVerificationSchema.index({ email: 1, type: 1 });

// Virtual getter for backward-compatibility in test runners
otpVerificationSchema.virtual("code").get(function () {
  return this.testPlainCode || null;
});

const OtpVerification =
  mongoose.models.OtpVerification ||
  mongoose.model("OtpVerification", otpVerificationSchema);

export default OtpVerification;
