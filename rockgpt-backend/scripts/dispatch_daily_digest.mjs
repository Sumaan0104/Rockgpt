import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

function logToFile(line) {
  try {
    const logsDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFile = path.join(logsDir, "daily_digest.log");
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`, "utf8");
  } catch {
    // Non-blocking log fallback
  }
}

process.env.JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secret_key_change_this_later_2026";

const mongoose = (await import("mongoose")).default;
const nodemailer = (await import("nodemailer")).default;
const { default: User } = await import("../models/User.js");
const {
  getPromptOfTheDay,
  buildDailyDigestHtml,
  filterAuthenticRecipients,
  isDeliverableDomain,
} = await import("../routes/admin.js");

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
  const targetEmail = targetEmailArg ? targetEmailArg.split("=")[1].trim().toLowerCase() : null;

  let recipients = [];

  if (targetEmail) {
    console.log(`[Targeted Mode] Sending exclusively to: ${targetEmail}`);
    const domain = targetEmail.split("@")[1];
    const mxValid = await isDeliverableDomain(domain);
    if (!mxValid) {
      console.error(`[Error] Target domain @${domain} has no valid MX records or is a test domain.`);
      process.exit(1);
    }
    recipients = [{ email: targetEmail, name: "Suman Mansuri" }];
  } else {
    console.log("[Batch Mode] Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[MongoDB] Connected successfully.");

    const dbUsers = await User.find({ email: { $exists: true, $ne: "" } })
      .select("name email googleId password passwordHash lastLoginAt isVerified")
      .lean();

    console.log(`[Database] Fetched ${dbUsers.length} total user records.`);

    const { verified, excluded } = await filterAuthenticRecipients(dbUsers);

    if (excluded.length > 0) {
      console.log(`\n[Filter] Excluded ${excluded.length} non-existent, test, or unverified accounts:`);
      excluded.forEach((e) => console.log(`  ✗ ${e.email} -> ${e.reason}`));
    }

    recipients = verified;
    console.log(`\n[Recipients] Verified ${recipients.length} authentic, deliverable registered users.`);
  }

  if (recipients.length === 0) {
    console.log("[Notice] No deliverable recipients found to dispatch.");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    return;
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
      logToFile(`✓ Delivered to ${recipient.email} (${info.messageId})`);
    } catch (err) {
      failedCount++;
      console.error(`✗ Failed sending to ${recipient.email}:`, err.message);
      logToFile(`✗ Failed sending to ${recipient.email}: ${err.message}`);
    }

    if (recipients.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const summary = `DISPATCH SUMMARY: ${sentCount} Sent, ${failedCount} Failed out of ${recipients.length} Total`;
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(summary);
  console.log("═══════════════════════════════════════════════════════");
  logToFile(summary);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Fatal dispatch error:", err);
  logToFile(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
