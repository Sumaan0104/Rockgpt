import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 259200, // 3 days TTL (3 * 24 * 60 * 60 seconds)
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on (key, date)
usageSchema.index({ key: 1, date: 1 }, { unique: true });

const Usage = mongoose.models.Usage || mongoose.model("Usage", usageSchema);
export default Usage;
