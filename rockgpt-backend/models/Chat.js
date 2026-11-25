import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
    },
    model: {
      type: String,
      default: "RockGPT Flash",
      trim: true,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    clientId: {
      type: String,
      default: null,
      sparse: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Compound index for fast queries: newest user chats first
chatSchema.index({ userId: 1, lastMessageAt: -1 });
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1, clientId: 1 }, { unique: true, sparse: true });
chatSchema.index({ title: "text" });

const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
export default Chat;
