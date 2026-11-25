import express from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function getUserFilter(userId) {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  return {
    $or: [{ userId: userObjectId }, { userId: String(userId) }],
  };
}

// 1. GET /api/chats — list non-deleted chats with cursor pagination & search
// Query: ?limit=30&cursor=&q=
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { cursor, q } = req.query;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const baseFilter = {
      userId: userObjectId,
      deletedAt: null,
    };

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        baseFilter.lastMessageAt = { $lt: cursorDate };
      }
    }

    if (typeof q === "string" && q.trim()) {
      const queryText = q.trim().slice(0, 100);
      const regex = new RegExp(queryText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i");

      // Search matching messages for this user to include their chats
      const matchingMessages = await Message.find({
        userId: userObjectId,
        content: regex,
      })
        .select("chatId")
        .limit(200)
        .lean();

      const matchedChatIds = matchingMessages
        .map((m) => m.chatId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

      baseFilter.$or = [
        { title: regex },
        { _id: { $in: matchedChatIds } },
      ];
    }

    const chatsList = await Chat.find(baseFilter)
      .sort({ pinned: -1, lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .select("_id title pinned lastMessageAt updatedAt createdAt clientId")
      .lean();

    const formatted = chatsList.map((c) => ({
      id: c._id.toString(),
      _id: c._id.toString(),
      title: c.title || "Untitled Conversation",
      pinned: Boolean(c.pinned),
      lastMessageAt: c.lastMessageAt || c.updatedAt || c.createdAt || new Date(),
      createdAt: c.createdAt || new Date(),
      updatedAt: c.updatedAt || new Date(),
      clientId: c.clientId || undefined,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Get chats error:", err.message);
    res.status(500).json({ error: "Failed to retrieve chats." });
  }
});

// 2. POST /api/chats — create new chat (supports idempotent clientId)
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, id, clientId } = req.body;
    const safeTitle = typeof title === "string" && title.trim() ? title.trim().slice(0, 80) : "New Chat";
    const now = new Date();
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Idempotent check by clientId
    if (clientId && typeof clientId === "string") {
      const existing = await Chat.findOne({ userId: userObjectId, clientId, deletedAt: null }).lean();
      if (existing) {
        return res.status(200).json({
          id: existing._id.toString(),
          _id: existing._id.toString(),
          title: existing.title,
          pinned: Boolean(existing.pinned),
          lastMessageAt: existing.lastMessageAt || existing.updatedAt || existing.createdAt,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          clientId: existing.clientId,
          messages: [],
        });
      }
    }

    const chatDoc = {
      userId: userObjectId,
      title: safeTitle,
      pinned: false,
      deletedAt: null,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      ...(clientId ? { clientId } : {}),
    };

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      chatDoc._id = new mongoose.Types.ObjectId(id);
    }

    const chat = await Chat.create(chatDoc);

    res.status(201).json({
      id: chat._id.toString(),
      _id: chat._id.toString(),
      title: chat.title,
      pinned: false,
      lastMessageAt: chat.lastMessageAt,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      clientId: chat.clientId || undefined,
      messages: [],
    });
  } catch (err) {
    console.error("Create chat error:", err.message);
    res.status(500).json({ error: "Failed to create conversation." });
  }
});

// 3. GET /api/chats/:id — full chat with paginated messages (?limit=&before=)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const before = req.query.before;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const chat = await Chat.findOne({
      _id: objectChatId,
      userId: userObjectId,
      deletedAt: null,
    }).lean();

    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const msgFilter = {
      $or: [{ chatId: objectChatId }, { conversationId: objectChatId }],
    };

    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        msgFilter.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(msgFilter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json({
      id: chat._id.toString(),
      _id: chat._id.toString(),
      title: chat.title || "Untitled Conversation",
      pinned: Boolean(chat.pinned),
      lastMessageAt: chat.lastMessageAt || chat.updatedAt || chat.createdAt,
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

        const firstImg = atts.find((a) => a.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)/i.test(a.url || a.name || ""))?.url || atts[0]?.url;

        return {
          id: m._id.toString(),
          _id: m._id.toString(),
          role: m.role,
          content: typeof m.content === "string" ? m.content : (m.content ? JSON.stringify(m.content) : ""),
          image: firstImg || undefined,
          attachments: atts,
          feedback: m.feedback || null,
          status: m.status || "complete",
          createdAt: m.createdAt,
        };
      }),
    });
  } catch (err) {
    console.error("Get chat by id error:", err.message);
    res.status(500).json({ error: "Failed to retrieve conversation." });
  }
});

// 4. PATCH /api/chats/:id — rename or pin/unpin chat
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { title, pinned } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const updates = { updatedAt: new Date() };
    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim().slice(0, 80);
    }
    if (typeof pinned === "boolean") {
      updates.pinned = pinned;
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: objectChatId, userId: userObjectId, deletedAt: null },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!chat) return res.status(404).json({ error: "Chat not found." });

    res.json({
      id: chat._id.toString(),
      _id: chat._id.toString(),
      title: chat.title,
      pinned: Boolean(chat.pinned),
      lastMessageAt: chat.lastMessageAt || chat.updatedAt,
      updatedAt: chat.updatedAt,
    });
  } catch (err) {
    console.error("Patch chat error:", err.message);
    res.status(500).json({ error: "Failed to update chat." });
  }
});

// 5. DELETE /api/chats/:id — soft delete (deletedAt)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const chat = await Chat.findOneAndUpdate(
      { _id: objectChatId, userId: userObjectId, deletedAt: null },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!chat) return res.status(404).json({ error: "Chat not found." });

    res.json({ success: true, message: "Chat deleted successfully." });
  } catch (err) {
    console.error("Delete chat error:", err.message);
    res.status(500).json({ error: "Failed to delete chat." });
  }
});

// 6. POST /api/chats/:id/restore — restore soft-deleted chat (powers 6-sec Undo toast)
router.post("/:id/restore", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const chat = await Chat.findOneAndUpdate(
      { _id: objectChatId, userId: userObjectId, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!chat) return res.status(404).json({ error: "Chat not found or already active." });

    res.json({
      success: true,
      chat: {
        id: chat._id.toString(),
        title: chat.title,
        pinned: Boolean(chat.pinned),
        lastMessageAt: chat.lastMessageAt,
      },
    });
  } catch (err) {
    console.error("Restore chat error:", err.message);
    res.status(500).json({ error: "Failed to restore chat." });
  }
});

// 7. PATCH /api/messages/:id/feedback — save feedback ('up'|'down'|null)
router.patch("/messages/:id/feedback", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const msgId = req.params.id;
    const { feedback } = req.body;

    if (![ "up", "down", null ].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback value. Must be 'up', 'down', or null." });
    }

    if (!mongoose.Types.ObjectId.isValid(msgId)) {
      return res.status(404).json({ error: "Message not found." });
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const msg = await Message.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(msgId), userId: userObjectId },
      { $set: { feedback } },
      { returnDocument: "after" }
    );

    if (!msg) return res.status(404).json({ error: "Message not found." });

    res.json({ success: true, feedback: msg.feedback });
  } catch (err) {
    console.error("Message feedback error:", err.message);
    res.status(500).json({ error: "Failed to update feedback." });
  }
});

// 8. POST /api/chats/import — bulk, idempotent import of guest chats from localStorage
router.post("/import", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const { chats = [] } = req.body;

    if (!Array.isArray(chats)) {
      return res.status(400).json({ error: "chats array required" });
    }

    // Limit import size to prevent abuse (max 100 chats, max 100 msgs each)
    const cappedChats = chats.slice(0, 100);
    let importedCount = 0;

    for (const c of cappedChats) {
      const clientId = c.clientId || (c.id ? String(c.id) : null);
      if (!clientId) continue;

      let chatDoc = await Chat.findOne({ userId: userObjectId, clientId });
      const now = new Date();

      if (!chatDoc) {
        chatDoc = await Chat.create({
          userId: userObjectId,
          clientId,
          title: typeof c.title === "string" ? c.title.slice(0, 80) : "Imported Chat",
          pinned: Boolean(c.pinned),
          deletedAt: null,
          lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : (c.t ? new Date(c.t) : now),
          createdAt: c.createdAt ? new Date(c.createdAt) : now,
          updatedAt: now,
        });
        importedCount++;
      }

      const importedMsgs = Array.isArray(c.msgs) ? c.msgs : Array.isArray(c.messages) ? c.messages : [];
      if (importedMsgs.length > 0) {
        const msgsToInsert = [];
        for (const m of importedMsgs.slice(0, 100)) {
          if (!m.content && (!m.files || !m.files.length)) continue;
          msgsToInsert.push({
            chatId: chatDoc._id,
            conversationId: chatDoc._id,
            userId: userObjectId,
            role: m.role === "assistant" || m.role === "bot" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : "",
            attachments: (m.files || m.attachments || []).map((f) => ({
              name: f.name || "Attachment",
              type: f.type || "",
              size: f.size || 0,
            })),
            feedback: m.feedback || null,
            status: m.status || "complete",
            createdAt: m.createdAt ? new Date(m.createdAt) : now,
          });
        }
        if (msgsToInsert.length > 0) {
          // Avoid duplicate insertion: delete old messages for this imported chat if re-importing
          await Message.deleteMany({ chatId: chatDoc._id });
          await Message.insertMany(msgsToInsert);
        }
      }
    }

    res.json({ success: true, imported: importedCount });
  } catch (err) {
    console.error("Bulk chat import error:", err.message);
    res.status(500).json({ error: "Failed to import chats." });
  }
});

// 9. Scheduled purge helper (older than 7 days)
export async function purgeSoftDeletedChats() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expired = await Chat.find({ deletedAt: { $ne: null, $lt: sevenDaysAgo } }).select("_id").lean();
    if (expired.length > 0) {
      const ids = expired.map((c) => c._id);
      await Promise.all([
        Chat.deleteMany({ _id: { $in: ids } }),
        Message.deleteMany({ chatId: { $in: ids } }),
      ]);
      console.log(`[Scheduled Purge] Cleaned up ${ids.length} soft-deleted chats older than 7 days.`);
    }
  } catch (err) {
    console.warn("[Purge Error]:", err.message);
  }
}

// 10. POST /api/chats/:id/messages — append message to chat
router.post("/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { role = "user", content = "", image, attachments } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Chat not found." });
    }

    const objectChatId = new mongoose.Types.ObjectId(chatId);
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    let chat = await Chat.findOne({ _id: objectChatId, userId: userObjectId, deletedAt: null });
    const now = new Date();
    if (!chat) {
      const existingOther = await Chat.findById(objectChatId).select("userId").lean();
      if (existingOther && String(existingOther.userId) !== String(userObjectId)) {
        return res.status(404).json({ error: "Chat not found." });
      }
      chat = await Chat.create({
        _id: objectChatId,
        userId: userObjectId,
        title: typeof content === "string" && content.trim() ? content.trim().slice(0, 42) : "New Chat",
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await Chat.updateOne({ _id: objectChatId }, { lastMessageAt: now, updatedAt: now });
    }

    let atts = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      atts = attachments;
    } else if (image) {
      atts = [{ name: "Image", type: "image/png", url: image }];
    }

    const msgDoc = await Message.create({
      chatId: objectChatId,
      conversationId: objectChatId,
      userId: userObjectId,
      role: role === "assistant" || role === "bot" ? "assistant" : "user",
      content: typeof content === "string" ? content : (content ? JSON.stringify(content) : ""),
      attachments: atts,
      createdAt: now,
    });

    res.status(201).json({
      id: msgDoc._id.toString(),
      _id: msgDoc._id.toString(),
      role: msgDoc.role,
      content: msgDoc.content,
      image: atts[0]?.url || undefined,
      attachments: atts,
      createdAt: msgDoc.createdAt,
    });
  } catch (err) {
    console.error("Save message error:", err.message);
    res.status(500).json({ error: "Failed to save message." });
  }
});

export default router;
