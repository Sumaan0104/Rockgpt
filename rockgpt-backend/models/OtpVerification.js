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
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["signup", "reset"],
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
  },
  {
    timestamps: true,
  }
);

otpVerificationSchema.index({ email: 1, type: 1 });

const OtpVerification =
  mongoose.models.OtpVerification ||
  mongoose.model("OtpVerification", otpVerificationSchema);

export default OtpVerification;
