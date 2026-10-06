import express from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// 1. GET /chats — list newest first, unified across Chat and Conversation collections
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    // Fetch from both Chat and legacy Conversation collections
    const [chatsList, convsList] = await Promise.all([
      Chat.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select("_id title updatedAt createdAt")
        .lean(),
      Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select("_id title updatedAt createdAt")
        .lean(),
    ]);

    // Deduplicate by string ID and preserve the freshest updatedAt
    const chatMap = new Map();

    for (const c of [...chatsList, ...convsList]) {
      const idStr = c._id.toString();
      if (!chatMap.has(idStr)) {
        chatMap.set(idStr, {
          id: idStr,
          _id: idStr,
          title: c.title || "Untitled Conversation",
          updatedAt: c.updatedAt || c.createdAt || new Date(),
          createdAt: c.createdAt || new Date(),
        });
      } else {
        const existing = chatMap.get(idStr);
        const thisUpdate = new Date(c.updatedAt || c.createdAt || 0);
        const prevUpdate = new Date(existing.updatedAt || 0);
        if (thisUpdate > prevUpdate) {
          existing.updatedAt = c.updatedAt;
          existing.title = c.title || existing.title;
        }
      }
    }

    const sorted = Array.from(chatMap.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    res.json(sorted);
  } catch (err) {
    console.error("Get chats error:", err.message);
    res.status(500).json({ error: "Failed to retrieve chats." });
  }
});

// 2. GET /chats/:id — full chat with messages from both chatId and conversationId
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Invalid chat ID format." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);

    // Look up in Chat first, then fallback to Conversation
    let chat = await Chat.findOne({ _id: objectChatId, userId }).lean();
    if (!chat) {
      chat = await Conversation.findOne({ _id: objectChatId, userId }).lean();
    }

    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }

    // Retrieve all messages matching either chatId or conversationId
    const messages = await Message.find({
      $or: [
        { chatId: objectChatId },
        { conversationId: objectChatId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      id: chat._id.toString(),
      _id: chat._id.toString(),
      title: chat.title || "Untitled Conversation",
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages: messages.map((m) => {
        let atts = [];
        if (Array.isArray(m.attachments) && m.attachments.length > 0) {
          atts = m.attachments;
        } else if (m.attachment) {
          atts = [
            {
              name: m.attachment.name || "",
              type: m.attachment.kind || m.attachment.type || "",
              url: m.attachment.dataUrl || m.attachment.url || "",
            },
          ];
        }

        return {
          id: m._id.toString(),
          _id: m._id.toString(),
          role: m.role,
          content: typeof m.content === "string" ? m.content : (m.content ? JSON.stringify(m.content) : ""),
          attachments: atts,
          createdAt: m.createdAt,
        };
      }),
    });
  } catch (err) {
    console.error("Get chat by id error:", err.message);
    res.status(500).json({ error: "Failed to retrieve conversation." });
  }
});

// 3. POST /chats — create new chat (mirrored in both Chat and Conversation)
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { title } = req.body;
    const safeTitle = (title || "New Chat").slice(0, 80);
    const now = new Date();

    const chat = await Chat.create({
      userId,
      title: safeTitle,
      createdAt: now,
      updatedAt: now,
    });

    // Mirror to Conversation
    await Conversation.create({
      _id: chat._id,
      userId,
      title: safeTitle,
      model: "RockGPT Flash",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    }).catch(() => {});

    res.status(201).json({
      id: chat._id.toString(),
      _id: chat._id.toString(),
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

// 4. PATCH /chats/:id — rename chat across both models
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Invalid chat ID format." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const safeTitle = title.trim().slice(0, 80);
    const now = new Date();

    const [chat, conv] = await Promise.all([
      Chat.findOneAndUpdate(
        { _id: objectChatId, userId },
        { title: safeTitle, updatedAt: now },
        { new: true }
      ),
      Conversation.findOneAndUpdate(
        { _id: objectChatId, userId },
        { title: safeTitle, updatedAt: now },
        { new: true }
      ),
    ]);

    const target = chat || conv;
    if (!target) return res.status(404).json({ error: "Chat not found." });

    res.json({
      id: target._id.toString(),
      _id: target._id.toString(),
      title: target.title,
      updatedAt: target.updatedAt,
    });
  } catch (err) {
    console.error("Rename chat error:", err.message);
    res.status(500).json({ error: "Failed to rename chat." });
  }
});

// 5. DELETE /chats/:id — delete chat and messages from both collections
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Invalid chat ID format." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);

    const [chat, conv] = await Promise.all([
      Chat.findOneAndDelete({ _id: objectChatId, userId }),
      Conversation.findOneAndDelete({ _id: objectChatId, userId }),
    ]);

    if (!chat && !conv) return res.status(404).json({ error: "Chat not found." });

    // Clean up all messages belonging to this chat via chatId or conversationId
    await Message.deleteMany({
      $or: [
        { chatId: objectChatId },
        { conversationId: objectChatId },
      ],
    });

    res.json({ success: true, message: "Chat deleted successfully." });
  } catch (err) {
    console.error("Delete chat error:", err.message);
    res.status(500).json({ error: "Failed to delete chat." });
  }
});

// 6. DELETE /chats — clear all chats for user across both collections
router.delete("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const [userChats, userConvs] = await Promise.all([
      Chat.find({ userId }).select("_id").lean(),
      Conversation.find({ userId }).select("_id").lean(),
    ]);

    const chatIds = [
      ...userChats.map((c) => c._id),
      ...userConvs.map((c) => c._id),
    ];

    if (chatIds.length > 0) {
      await Message.deleteMany({
        $or: [
          { chatId: { $in: chatIds } },
          { conversationId: { $in: chatIds } },
        ],
      });
    }

    await Promise.all([
      Chat.deleteMany({ userId }),
      Conversation.deleteMany({ userId }),
    ]);

    res.json({ success: true, message: "All conversations cleared." });
  } catch (err) {
    console.error("Clear all chats error:", err.message);
    res.status(500).json({ error: "Failed to clear chats." });
  }
});

export default router;
