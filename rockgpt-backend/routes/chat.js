import express from "express";
import OpenAI from "openai";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import { authMiddleware } from "../middleware/auth.js";
import { chatRateLimiter, dailyUsageLimit } from "../middleware/limit.js";

const router = express.Router();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy_groq_key",
  baseURL: "https://api.groq.com/openai/v1",
});

const ACTIVE_GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// Canonical 99 Names reference for strict accuracy
const canonicalAsmaUlHusna = `1. Ar-Rahman (الرحمن) - The Beneficent
2. Ar-Rahim (الرحيم) - The Merciful
3. Al-Malik (الملك) - The King
4. Al-Quddus (القدوس) - The Most Holy
5. As-Salam (السلام) - The Source of Peace
6. Al-Mu'min (المؤمن) - The Guardian of Faith
7. Al-Muhaymin (المهيمن) - The Protector
8. Al-Aziz (العزيز) - The Mighty
9. Al-Jabbar (الجبار) - The Compeller
10. Al-Mutakabbir (المتكبر) - The Majestic
11. Al-Khaliq (الخالق) - The Creator
12. Al-Bari (البارئ) - The Evolver
13. Al-Musawwir (المصور) - The Fashioner
14. Al-Ghaffar (الغفار) - The Constant Forgiver
15. Al-Qahhar (القهار) - The Subduer
16. Al-Wahhab (الوهاب) - The Bestower
17. Ar-Razzaq (الرزاق) - The Provider
18. Al-Fattah (الفتاح) - The Opener
19. Al-Alim (العليم) - The All-Knowing
20. Al-Qabid (القابض) - The Withholder
21. Al-Basit (الباسط) - The Expander
22. Al-Khafid (الخافض) - The Abaser
23. Ar-Rafi (الرافع) - The Exalter
24. Al-Mu'izz (المعز) - The Bestower of Honor
25. Al-Mudhill (المذل) - The Humiliator
26. As-Sami (السميع) - The All-Hearing
27. Al-Basir (البصير) - The All-Seeing
28. Al-Hakam (الحكم) - The Judge
29. Al-Adl (العدل) - The Utterly Just
30. Al-Latif (اللطيف) - The Subtle One
31. Al-Khabir (الخبير) - The All-Aware
32. Al-Halim (الحليم) - The Forbearing
33. Al-Azim (العظيم) - The Magnificent
34. Al-Ghafur (الغفور) - The Forgiving
35. Ash-Shakur (الشكور) - The Most Appreciative
36. Al-Ali (العلي) - The Most High
37. Al-Kabir (الكبير) - The Most Great
38. Al-Hafiz (الحفيظ) - The Preserver
39. Al-Muqit (المقيت) - The Sustainer
40. Al-Hasib (الحسيب) - The Reckoner
41. Al-Jalil (الجليل) - The Sublime
42. Al-Karim (الكريم) - The Generous
43. Ar-Raqib (الرقيب) - The Watchful
44. Al-Mujib (المجيب) - The Responsive
45. Al-Wasi (الواسع) - The All-Encompassing
46. Al-Hakim (الحكيم) - The Wise
47. Al-Wadud (الودود) - The Loving
48. Al-Majid (المجيد) - The All-Glorious
49. Al-Ba'ith (الباعث) - The Resurrector
50. Ash-Shahid (الشهيد) - The Witness
51. Al-Haqq (الحق) - The Truth
52. Al-Wakil (الوكيل) - The Trustee
53. Al-Qawiyy (القوي) - The Strong
54. Al-Matin (المتين) - The Firm
55. Al-Waliyy (الولي) - The Protecting Friend
56. Al-Hamid (الحميد) - The Praiseworthy
57. Al-Muhsi (المحصي) - The Accounter
58. Al-Mubdi (المبدئ) - The Originator
59. Al-Mu'id (المعيد) - The Restorer
60. Al-Muhyi (المحيي) - The Giver of Life
61. Al-Mumit (المميت) - The Creator of Death
62. Al-Hayy (الحي) - The Ever-Living
63. Al-Qayyum (القيوم) - The Self-Subsisting
64. Al-Wajid (الواجد) - The Perceiver
65. Al-Majid (الماجد) - The Illustrious
66. Al-Wahid (الواحد) - The One
67. Al-Ahad (الأحد) - The Unique
68. As-Samad (الصمد) - The Eternal
69. Al-Qadir (القادر) - The Capable
70. Al-Muqtadir (المقتدر) - The Determiner
71. Al-Muqaddim (المقدم) - The Expediter
72. Al-Mu'akhkhir (المؤخر) - The Delayer
73. Al-Awwal (الأول) - The First
74. Al-Akhir (الآخر) - The Last
75. Az-Zahir (الظاهر) - The Manifest
76. Al-Batin (الباطن) - The Hidden
77. Al-Wali (الوالي) - The Governor
78. Al-Muta'ali (المتعالي) - The Most Exalted
79. Al-Barr (البر) - The Source of All Goodness
80. At-Tawwab (التواب) - The Ever-Pardoning
81. Al-Muntaqim (المنتقم) - The Avenger
82. Al-Afuww (العفو) - The Pardoner
83. Ar-Ra'uf (الرؤوف) - The Compassionate
84. Malik-ul-Mulk (مالك الملك) - The Owner of All Sovereignty
85. Dhul-Jalali wal-Ikram (ذو الجلال والإكرام) - The Lord of Majesty and Generosity
86. Al-Muqsit (المقسط) - The Equitable
87. Al-Jami (الجامع) - The Gatherer
88. Al-Ghaniyy (الغني) - The Self-Sufficient
89. Al-Mughni (المغني) - The Enricher
90. Al-Mani (المانع) - The Withholder / Preventer
91. Ad-Darr (الضار) - The Distressor
92. An-Nafi (النافع) - The Propitious / Benefactor
93. An-Nur (النور) - The Light
94. Al-Hadi (الهادي) - The Guide
95. Al-Badi (البديع) - The Incomparable
96. Al-Baqi (الباقي) - The Everlasting
97. Al-Warith (الوارث) - The Supreme Inheritor
98. Ar-Rashid (الرشيد) - The Guide to the Right Path
99. As-Sabur (الصبور) - The Patient`;

function buildSystemPrompt(fast = false) {
  return `You are RockGPT, an advanced, highly intelligent AI assistant developed and engineered by Suman Mansuri ("Rock"). Never mention OpenAI, Groq, Google, Meta, or third-party providers. You are powered by RockGPT's proprietary high-performance neural architecture.

Creator Persona & Attribution:
If asked about your creator, Rock, or Suman Mansuri (including questions about who made you, who he is, his skills, or whether he is intelligent), answer with confidence, technical respect, and complete clarity: Suman Mansuri (widely known as "Rock") is an exceptionally talented full-stack software engineer, systems architect, and AI builder who conceived, designed, and engineered RockGPT from the ground up. He possesses deep expertise across modern distributed systems, full-stack application development, real-time streaming architectures, and neural model integration. His sharp intellect, architectural foresight, and relentless pursuit of engineering excellence are what made RockGPT possible. Always be insightful, polite, highly capable, and accurate.

Formatting Guidelines:
- Format code blocks using triple backticks with the exact language specified (e.g. \`\`\`javascript, \`\`\`python).
- Use clear markdown headers (##, ###), bullet points, bold emphasis, and clean tables for data sets.
- Never output raw unformatted text when code, lists, or tables are appropriate.

Strict Non-Repetition & Canonical Enumeration Rule:
Every item in an enumeration, list, or table MUST be completely unique, accurate, and authentic. Never repeat items, duplicate rows, or append "(Repeated)" or "(re-appears)".
When asked for the 99 Names of Allah (Asma' ul-Husna):
- You MUST strictly provide all 99 unique canonical names without ANY repetition from #1 to #99.
- Sequence reference (1 to 99):
${canonicalAsmaUlHusna}
- Present them in a single, beautiful Markdown table with columns: | # | Arabic | Transliteration | English Meaning |.
- Conclude cleanly immediately after the 99th entry (As-Sabur). Never start over, never loop, and never add extra rows beyond 99.

Exhaustive Completeness:
Whenever the user asks for enumerations or complete sets, you must ALWAYS provide the COMPLETE, FULL list from start to finish without skipping or stopping halfway.${fast ? " Be swift and concise in narrative explanations while keeping lists and data sets 100% complete." : ""}`;
}

async function streamGeminiChat(messages, systemPrompt, fast, res) {
  if (!ACTIVE_GEMINI_KEY) return false;

  const contents = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const parts = [];

    if (typeof m.content === "string" && m.content.trim()) {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === "text" && p.text) parts.push({ text: p.text });
        else if (p.type === "image_url") {
          const url = p.image_url?.url || "";
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
        }
      }
    }

    if (m.attachments && Array.isArray(m.attachments)) {
      for (const a of m.attachments) {
        if (a.dataUrl) {
          const match = a.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
        } else if (a.text) {
          parts.push({ text: `Attachment [${a.name}]:\n${a.text}` });
        }
      }
    }

    if (parts.length) contents.push({ role, parts });
  }

  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "Hello" }] });
  }

  const payload = {
    contents,
    system_instruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: fast ? 0.3 : 0.6,
      maxOutputTokens: fast ? 4096 : 8192,
    },
  };

  const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
  let response = null;

  for (const modelName of modelsToTry) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${ACTIVE_GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (resp.ok) {
        response = resp;
        break;
      }
    } catch {}
  }

  if (!response) return false;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokensStreamed = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr);
        const parts = parsed.candidates?.[0]?.content?.parts || [];
        for (const pt of parts) {
          if (pt.text) {
            tokensStreamed++;
            res.write(`data: ${JSON.stringify({ token: pt.text })}\n\n`);
          }
        }
      } catch {}
    }
  }

  return tokensStreamed > 0;
}

// ═══ POST /api/chat — Real SSE Stream ═══
router.post("/", authMiddleware, chatRateLimiter, dailyUsageLimit, async (req, res) => {
  let isClosed = false;
  req.on("close", () => {
    isClosed = true;
  });

  try {
    const { chatId, messages, fast } = req.body;
    if (!messages || !Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages array is required." });
    }

    // Set immediate SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const lastMessage = messages[messages.length - 1];

    // If valid chatId and user authenticated, save user message to DB before streaming
    let validChat = null;
    if (chatId && req.user && mongoose.Types.ObjectId.isValid(chatId)) {
      try {
        validChat = await Chat.findOne({ _id: chatId, userId: req.user._id });
        if (validChat && lastMessage && lastMessage.role === "user") {
          await Message.create({
            chatId: validChat._id,
            role: "user",
            content: lastMessage.content || "",
            attachments: (lastMessage.attachments || []).map((a) => ({
              name: a.name || "",
              type: a.type || "",
            })),
          });
          validChat.updatedAt = new Date();
          await validChat.save();
        }
      } catch (dbErr) {
        console.warn("DB user message save warning:", dbErr.message);
      }
    }

    const systemPrompt = buildSystemPrompt(fast);
    let fullAssistantResponse = "";

    // 1. Check if message has image attachments -> try Gemini vision first
    const hasMedia = messages.some(
      (m) =>
        (m.attachments && m.attachments.some((a) => a.dataUrl)) ||
        (Array.isArray(m.content) && m.content.some((c) => c.type === "image_url"))
    );

    let handledByGemini = false;
    if (hasMedia && ACTIVE_GEMINI_KEY) {
      try {
        handledByGemini = await streamGeminiChat(messages, systemPrompt, fast, res);
      } catch (gemErr) {
        console.warn("Gemini stream error:", gemErr.message);
      }
    }

    // 2. Groq streaming engine (ultra-fast primary text engine)
    if (!handledByGemini) {
      const groqModels = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];
      let stream = null;

      // Format messages for Groq OpenAI compatibility
      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => {
          let text = "";
          if (typeof m.content === "string") text = m.content;
          else if (Array.isArray(m.content)) {
            text = m.content
              .filter((p) => p.type === "text" && p.text)
              .map((p) => p.text)
              .join("\n");
          }
          if (m.attachments && Array.isArray(m.attachments)) {
            for (const a of m.attachments) {
              if (a.text) text += `\n\n[Attachment ${a.name}]:\n${a.text}`;
            }
          }
          return {
            role: m.role === "assistant" ? "assistant" : "user",
            content: text || "Hello",
          };
        }),
      ];

      for (const model of groqModels) {
        if (isClosed) break;
        try {
          stream = await groq.chat.completions.create({
            model,
            max_tokens: fast ? 2048 : 8192,
            temperature: 0.5,
            messages: groqMessages,
            stream: true,
          });
          if (stream) break;
        } catch (e) {
          console.warn(`Groq model ${model} failed:`, e.message);
        }
      }

      if (stream) {
        for await (const chunk of stream) {
          if (isClosed) break;
          const token = chunk.choices[0]?.delta?.content || "";
          if (token) {
            fullAssistantResponse += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        }
      } else {
        // Fallback to Gemini if Groq was unavailable
        if (ACTIVE_GEMINI_KEY) {
          await streamGeminiChat(messages, systemPrompt, fast, res);
        } else {
          const fallbackMsg = "I'm experiencing high neural traffic. Please tap 'Regenerate' or try again in a moment.";
          fullAssistantResponse = fallbackMsg;
          res.write(`data: ${JSON.stringify({ token: fallbackMsg })}\n\n`);
        }
      }
    }

    // 3. Save assistant message to MongoDB if chat is tracked
    if (validChat && fullAssistantResponse && !isClosed) {
      try {
        await Message.create({
          chatId: validChat._id,
          role: "assistant",
          content: fullAssistantResponse,
        });
        validChat.updatedAt = new Date();
        await validChat.save();
      } catch (err) {
        console.warn("Failed to persist assistant reply:", err.message);
      }
    }

    if (!isClosed) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error("Chat streaming endpoint error:", err.message);
    if (!isClosed) {
      try {
        res.write(`data: ${JSON.stringify({ error: "The AI service is temporarily busy. Please tap 'Regenerate' or try again." })}\n\n`);
        res.end();
      } catch {}
    }
  }
});

export default router;
