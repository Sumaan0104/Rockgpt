import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

process.env.JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secret_key_change_this_later_2026";

const mongoose = (await import("mongoose")).default;
const nodemailer = (await import("nodemailer")).default;
const { default: User } = await import("../models/User.js");
const { getPromptOfTheDay, buildDailyDigestHtml } = await import("../routes/admin.js");

const user = (process.env.EMAIL_USER || "").trim();
const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

if (!user || !pass) {
  console.error("Missing EMAIL_USER or EMAIL_PASS in .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});

async function run() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  ROCKGPT DAILY ENGAGEMENT DISPATCHER");
  console.log("═══════════════════════════════════════════════════════");

  const targetEmailArg = process.argv.find((a) => a.startsWith("--email="));
  const targetEmail = targetEmailArg ? targetEmailArg.split("=")[1].trim() : null;

  let recipients = [];

  if (targetEmail) {
    console.log(`[Targeted Mode] Sending exclusively to: ${targetEmail}`);
    recipients = [{ email: targetEmail, name: "Suman Mansuri" }];
  } else {
    console.log("[Batch Mode] Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[MongoDB] Connected successfully.");

    const dbUsers = await User.find({ email: { $exists: true, $ne: "" } }).select("name email").lean();
    recipients = (dbUsers || [])
      .map((u) => ({ email: String(u.email).trim().toLowerCase(), name: u.name || "" }))
      .filter((u) => u.email && u.email.includes("@"));

    console.log(`[Recipients] Found ${recipients.length} registered users in database.`);
  }

  const promptOfTheDay = getPromptOfTheDay();
  const proTip = "You can upload documents and code files directly to get instant debugging and reasoning breakdowns.";
  const link = "https://rockgpt-ten.vercel.app";

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      const formattedTo = recipient.name
        ? `"${recipient.name.replace(/["\r\n]/g, "").trim()}" <${recipient.email}>`
        : recipient.email;

      const html = buildDailyDigestHtml({
        user: recipient,
        promptOfTheDay,
        proTip,
        ctaUrl: link,
      });

      const info = await transporter.sendMail({
        from: `"RockGPT" <${user}>`,
        to: formattedTo,
        subject: "Explore More with RockGPT: Today's Power Prompt & Tips 🚀",
        html,
      });

      sentCount++;
      console.log(`✓ Delivered to ${recipient.email} (MessageId: ${info.messageId})`);
    } catch (err) {
      failedCount++;
      console.error(`✗ Failed sending to ${recipient.email}:`, err.message);
    }

    if (recipients.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`DISPATCH SUMMARY: ${sentCount} Sent, ${failedCount} Failed out of ${recipients.length} Total`);
  console.log("═══════════════════════════════════════════════════════");

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Fatal dispatch error:", err);
  process.exit(1);
});
