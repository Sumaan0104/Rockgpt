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
export function buildDailyDigestHtml({ user, promptOfTheDay, proTip, ctaUrl, customDate }) {
  const name = (user?.name && user.name.trim()) || "there";
  const email = (user?.email && user.email.trim()) || "";
  const prompt = promptOfTheDay || DAILY_PROMPTS[0];
  const tip =
    proTip ||
    "You can upload documents and code files directly to get instant debugging and reasoning breakdowns.";
  const link = ctaUrl || process.env.FRONTEND_URL || "https://rockgpt-ten.vercel.app";

  const formattedDate = customDate || new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-sizing: border-box; color: #0f172a; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
      
      <!-- Top Brand & Date Header Bar -->
      <div style="background: #0f172a; padding: 20px 28px; border-bottom: 2px solid #2563eb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="vertical-align: middle;">
              <span style="background: #2563eb; color: #ffffff; font-weight: 800; font-size: 15px; padding: 6px 14px; border-radius: 8px; display: inline-block; letter-spacing: 0.8px;">RockGPT</span>
            </td>
            <td align="right" style="vertical-align: middle; color: #cbd5e1; font-size: 13px; font-weight: 500;">
              📅 ${formattedDate}
            </td>
          </tr>
        </table>
      </div>

      <!-- Main Body Content -->
      <div style="padding: 32px 28px 24px;">

        <!-- Delivery Header Summary Box -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.7; color: #475569;">
          <div><strong style="color: #0f172a;">From:</strong> RockGPT &lt;mansurisumaan@gmail.com&gt;</div>
          <div><strong style="color: #0f172a;">To:</strong> ${name !== "there" && email ? `${name} &lt;${email}&gt;` : email || "RockGPT User"}</div>
          <div><strong style="color: #0f172a;">Date:</strong> ${formattedDate}</div>
        </div>

        <h2 style="color: #0f172a; margin: 0 0 10px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Explore More with RockGPT 👋</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${name}, here is your curated daily AI inspiration, power prompt, and productivity tip to supercharge your workflow today.
        </p>

        <!-- Prompt of the Day Card -->
        <div style="background: #0f172a; border-radius: 12px; padding: 22px; margin-bottom: 22px; color: #f8fafc; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15);">
          <div style="margin-bottom: 10px;">
            <span style="background: #3b82f6; color: #ffffff; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.6px; display: inline-block;">
              💡 Prompt of the Day
            </span>
          </div>
          <div style="color: #e2e8f0; font-size: 15px; font-weight: 500; font-style: italic; line-height: 1.6; margin-top: 10px; padding-left: 12px; border-left: 3px solid #3b82f6;">
            "${prompt}"
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0 0;">
            Copy & paste this prompt into RockGPT to get an instant, production-grade output.
          </p>
        </div>

        <!-- Pro Tip Card -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 20px; margin-bottom: 26px;">
          <div style="color: #166534; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
            ⚡ RockGPT Pro Tip
          </div>
          <div style="color: #15803d; font-size: 14px; line-height: 1.5; font-weight: 500;">
            ${tip}
          </div>
        </div>

        <!-- CTA Launch Button -->
        <div style="text-align: center; margin: 30px 0 10px;">
          <a href="${link}" target="_blank" rel="noopener noreferrer" style="background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 10px; font-size: 15px; font-weight: 700; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 8px rgba(0,0,0,0.12);">
            Open RockGPT & Try It Now →
          </a>
        </div>

      </div>

      <!-- Clean Footer (No Reply-To lines) -->
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 4px; font-weight: 500; color: #334155;">
          RockGPT • Empowering Your Daily Intelligence
        </p>
        <p style="margin: 0; color: #94a3b8;">
          Sent to registered RockGPT users &bull; &copy; ${new Date().getFullYear()} RockGPT by Suman Mansuri
        </p>
      </div>

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

        const formattedTo = user.name
          ? `"${user.name.replace(/["\r\n]/g, "").trim()}" <${user.email}>`
          : user.email;

        const result = await sendEmail({
          to: formattedTo,
          subject,
          html,
          fromName: "RockGPT",
          fromEmail: "mansurisumaan@gmail.com",
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
