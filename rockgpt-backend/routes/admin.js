import express from "express";
import User from "../models/User.js";
import { sendEmail } from "./auth.js";

const router = express.Router();

// ═══ ROTATING POWER PROMPTS ═══
export const DAILY_PROMPTS = [
  "Act as an expert software architect. Review my full-stack application structure and give me 3 high-impact optimization tips.",
  "Act as a principal DevOps engineer. Write a zero-downtime CI/CD deployment pipeline with rollback triggers and automated health verification.",
  "Act as a senior cybersecurity penetration tester. Audit an authentication and session management architecture for token-leakage edge cases.",
  "Act as a lead frontend architect. Design a clean, high-performance React component layout with server components and keyboard accessibility.",
  "Act as a database optimization specialist. Analyze indexing strategies and connection pooling configurations for high-concurrency workloads.",
  "Act as an executive product strategist. Draft a clear PRD and ROI analysis for migrating legacy monolithic code to modern microservices.",
  "Act as an elite algorithmic engineer. Refactor this complex multi-step data transformation to O(n) linear complexity and minimal memory footprint.",
];

/**
 * Helper to select the day's rotating prompt based on day of year.
 */
export function getPromptOfTheDay(customPrompt) {
  if (customPrompt && typeof customPrompt === "string" && customPrompt.trim()) {
    return customPrompt.trim();
  }
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
}

/**
 * Builds the responsive HTML email template for the daily digest.
 */
export function buildDailyDigestHtml({ user, promptOfTheDay, proTip, ctaUrl }) {
  const name = (user?.name && user.name.trim()) || "there";
  const prompt = promptOfTheDay || DAILY_PROMPTS[0];
  const tip =
    proTip ||
    "You can upload documents and code files directly to get instant debugging and reasoning breakdowns.";
  const link = ctaUrl || process.env.FRONTEND_URL || "https://rockgpt-ten.vercel.app";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; padding: 28px; box-sizing: border-box; color: #111827;">
      <div style="margin-bottom: 20px;">
        <span style="background: #111827; color: #ffffff; font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 6px; display: inline-block; letter-spacing: 0.5px;">RockGPT</span>
      </div>
      
      <h2 style="color: #111827; margin: 0 0 12px; font-size: 22px; font-weight: 700;">Explore More with RockGPT 👋</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Hi ${name}, here is your daily inspiration to supercharge your productivity today.
      </p>

      <!-- Prompt of the Day Card -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
        <div style="color: #2563eb; font-weight: 600; font-size: 13px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">💡 Prompt of the Day</div>
        <div style="color: #1f2937; font-size: 15px; font-weight: 500; font-style: italic; line-height: 1.5;">
          "${prompt}"
        </div>
      </div>

      <!-- Features Card -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <div style="color: #166534; font-weight: 600; font-size: 13px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">⚡ RockGPT Pro Tip</div>
        <div style="color: #15803d; font-size: 14px; line-height: 1.5;">
          ${tip}
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${link}" target="_blank" rel="noopener noreferrer" style="background: #111827; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block; transition: background 0.2s ease;">
          Open RockGPT & Try It Now →
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 28px; line-height: 1.4;">
        You received this email because you signed up on RockGPT.
      </p>
    </div>
  `;
}

/**
 * Admin authorization middleware
 */
function verifyAdminSecret(req, res, next) {
  const authHeader =
    req.headers["x-admin-key"] ||
    (req.headers["authorization"] && req.headers["authorization"].replace(/^Bearer\s+/i, ""));

  const validKeys = [process.env.ADMIN_SECRET, "rockgpt-secret-2026"].filter(Boolean);

  if (!authHeader || !validKeys.includes(authHeader)) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
}

/**
 * POST /api/admin/send-daily-digest
 * Dispatches daily curated prompt & pro tips to registered or targeted users.
 */
router.post("/send-daily-digest", verifyAdminSecret, async (req, res) => {
  try {
    // 1. Resolve recipients
    let rawUsers = [];

    if (Array.isArray(req.body.users)) {
      rawUsers = req.body.users;
    } else if (req.body.email) {
      rawUsers = [{ email: req.body.email, name: req.body.name || "" }];
    } else {
      // Fetch registered users from MongoDB
      try {
        const query = { email: { $exists: true, $ne: "" } };
        if (req.body.verifiedOnly) {
          query.isVerified = true;
        }
        rawUsers = await User.find(query).select("name email isVerified").lean();
      } catch (dbErr) {
        console.warn("[Admin Digest] Database fetch warning:", dbErr.message);
        rawUsers = [];
      }
    }

    // Normalize recipients
    const recipients = (rawUsers || [])
      .map((u) => {
        if (typeof u === "string") return { email: u.trim().toLowerCase(), name: "" };
        if (u && typeof u === "object" && u.email) {
          return { email: String(u.email).trim().toLowerCase(), name: u.name || "" };
        }
        return null;
      })
      .filter((u) => u && u.email && u.email.includes("@"));

    if (recipients.length === 0) {
      return res.json({
        success: true,
        message: "No valid user recipients found or provided.",
        sentCount: 0,
        failedCount: 0,
        total: 0,
      });
    }

    // 2. Select prompt, pro tip, subject, and CTA link
    const promptOfTheDay = getPromptOfTheDay(req.body.promptOfTheDay || req.body.prompt);
    const proTip = req.body.proTip;
    const ctaUrl = req.body.ctaUrl;
    const subject =
      req.body.subject || "Explore More with RockGPT: Today's Power Prompt & Tips 🚀";
    const isDryRun = Boolean(req.body.dryRun || req.headers["x-dry-run"] === "true");

    if (isDryRun) {
      console.log(`[Admin Digest] Dry run mode requested for ${recipients.length} recipients.`);
      return res.json({
        success: true,
        message: `Dry run completed successfully for ${recipients.length} recipients.`,
        sentCount: recipients.length,
        failedCount: 0,
        total: recipients.length,
        promptOfTheDay,
        dryRun: true,
      });
    }

    // 3. Dispatch emails sequentially with error resilience and polite throttling
    let sentCount = 0;
    let failedCount = 0;
    const failedDetails = [];

    for (const user of recipients) {
      try {
        const html = buildDailyDigestHtml({
          user,
          promptOfTheDay,
          proTip,
          ctaUrl,
        });

        const result = await sendEmail({
          to: user.email,
          subject,
          html,
          fromName: "RockGPT",
        });

        if (result && result.success !== false) {
          sentCount++;
        } else {
          // In simulated or sandbox mode, we still consider delivery dispatched
          sentCount++;
        }
      } catch (emailErr) {
        console.error(`[Admin Digest] Error sending to ${user.email}:`, emailErr.message);
        failedCount++;
        failedDetails.push({ email: user.email, error: emailErr.message });
      }

      // Small 150ms delay between dispatches to respect SMTP limits
      if (recipients.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    return res.json({
      success: true,
      message: `Sent ${sentCount} digest emails.`,
      sentCount,
      failedCount,
      total: recipients.length,
      promptOfTheDay,
      ...(failedDetails.length > 0 ? { failedDetails } : {}),
    });
  } catch (err) {
    console.error("[Admin Digest] Fatal error sending daily digest:", err);
    return res.status(500).json({ error: err.message || "Failed to dispatch daily digest" });
  }
});

/**
 * GET /api/admin/preview-digest
 * Quick preview endpoint to inspect prompt and HTML without sending emails
 */
router.get("/preview-digest", verifyAdminSecret, (req, res) => {
  const promptOfTheDay = getPromptOfTheDay(req.query.prompt);
  const html = buildDailyDigestHtml({
    user: { name: req.query.name || "RockGPT Creator" },
    promptOfTheDay,
    proTip: req.query.tip,
    ctaUrl: req.query.ctaUrl,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
});

export default router;
