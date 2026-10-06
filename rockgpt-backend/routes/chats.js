import express from "express";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// 1. GET /chats — list newest first, no message bodies (fast)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("_id title updatedAt createdAt")
      .lean();

    const formatted = chats.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Get chats error:", err.message);
    res.status(500).json({ error: "Failed to retrieve chats." });
  }
});

// 2. GET /chats/:id — full chat with messages
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    const chat = await Chat.findOne({ _id: chatId, userId }).lean();
    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .select("role content attachments createdAt")
      .lean();

    res.json({
      id: chat._id.toString(),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("Get chat by id error:", err.message);
    res.status(500).json({ error: "Failed to retrieve conversation." });
  }
});

// 3. POST /chats — create new chat
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { title } = req.body;

    const chat = await Chat.create({
      userId,
      title: (title || "New Chat").slice(0, 80),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      id: chat._id.toString(),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages: [],
    });
  } catch (err) {
    console.error("Create chat error:", err.message);
    res.status(500).json({ error: "Failed to create conversation." });
  }
});

// 4. PATCH /chats/:id — rename chat
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required." });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId },
      { title: title.trim().slice(0, 80), updatedAt: new Date() },
      { new: true }
    );

    if (!chat) return res.status(404).json({ error: "Chat not found." });

    res.json({
      id: chat._id.toString(),
      title: chat.title,
      updatedAt: chat.updatedAt,
    });
  } catch (err) {
    console.error("Rename chat error:", err.message);
    res.status(500).json({ error: "Failed to rename chat." });
  }
});

// 5. DELETE /chats/:id — delete chat and messages
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    const chat = await Chat.findOneAndDelete({ _id: chatId, userId });
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    // Clean up all messages belonging to this chat
    await Message.deleteMany({ chatId });

    res.json({ success: true, message: "Chat deleted successfully." });
  } catch (err) {
    console.error("Delete chat error:", err.message);
    res.status(500).json({ error: "Failed to delete chat." });
  }
});

// 6. DELETE /chats — clear all chats for user
router.delete("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const userChats = await Chat.find({ userId }).select("_id").lean();
    const chatIds = userChats.map((c) => c._id);

    await Message.deleteMany({ chatId: { $in: chatIds } });
    await Chat.deleteMany({ userId });

    res.json({ success: true, message: "All conversations cleared." });
  } catch (err) {
    console.error("Clear all chats error:", err.message);
    res.status(500).json({ error: "Failed to clear chats." });
  }
});

export default router;
