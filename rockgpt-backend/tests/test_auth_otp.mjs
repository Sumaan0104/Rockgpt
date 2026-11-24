import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secret_key_change_this_later_2026";
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "2d88c438e89b1542f0424c76bd10264076b4a792d63f6580e8646c705ef7dd9f";
process.env.INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || "b15008d697f6b0367afcf241e7cbab628410d406d99a1cd477837f42c64f0ead";

const { default: app } = await import("../server.js");
const { default: User } = await import("../models/User.js");
const { default: OtpVerification } = await import("../models/OtpVerification.js");
const { default: OtpRateLimit } = await import("../models/OtpRateLimit.js");

let server;
let serverUrl;

function startTestServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function stopTestServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

async function request(path, options = {}) {
  const url = `${serverUrl}${path}`;
  const res = await fetch(url, options);
  let body = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else if (contentType.includes("text/")) {
    body = await res.text().catch(() => null);
  }
  return { status: res.status, headers: res.headers, body, raw: res };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runAuthOtpTests() {
  console.log("\n==================================================");
  console.log("🧪 ROCKGPT EXTENDED AUTHENTICATION & OTP TEST SUITE");
  console.log("==================================================\n");

  await startTestServer();

  const testEmail = `testuser_${Date.now()}@rockgpt.local`;
  const testPassword = "Password123#Secure!";
  const testName = "Suman Test User";

  // Clean any prior artifacts
  await User.deleteMany({ email: testEmail }).catch(() => {});
  await OtpVerification.deleteMany({ email: testEmail }).catch(() => {});
  await OtpRateLimit.deleteMany({ key: { $regex: testEmail } }).catch(() => {});

  // ─── TEST 1: SIGNUP CREATES AND PERSISTS USER & PASSWORD IN MONGODB ───
  console.log("--- 1. User Registration & Immediate Password Persistence ---");
  const signupRes = await request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: testPassword,
    }),
  });

  assert(signupRes.status === 200, `Signup returns HTTP 200 (got ${signupRes.status})`);
  assert(signupRes.body?.success === true, "Signup response indicates success");
  assert(Boolean(signupRes.body?.token), "Signup returns authenticated session token");

  // Verify MongoDB User record exists immediately!
  const dbUser = await User.findOne({ email: testEmail });
  assert(Boolean(dbUser), "User account persisted immediately in MongoDB User collection");
  assert(dbUser?.name === testName, "User name persisted correctly");
  assert(Boolean(dbUser?.passwordHash), "User passwordHash persisted securely in MongoDB");
  assert(dbUser?.passwordHash !== testPassword, "Password is encrypted/hashed with bcrypt, NOT stored in plaintext");

  const isBcryptMatch = await bcrypt.compare(testPassword, dbUser.passwordHash);
  assert(isBcryptMatch === true, "Bcrypt hash compares correctly with the plaintext password");

  // Verify OTP verification record exists with cryptographic HMAC hash
  const otpDoc = await OtpVerification.findOne({ email: testEmail, type: "signup" });
  assert(Boolean(otpDoc), "OTP verification document created in OtpVerification collection");
  assert(Boolean(otpDoc?.codeHash), "OTP is stored as a cryptographic hash in MongoDB, not plain");
  assert(Boolean(otpDoc?.code) && otpDoc.code.length === 6, "OTP code virtual provides 6-digit verification code");

  // ─── TEST 2: USER CAN SIGN IN IMMEDIATELY WITH STORED PASSWORD ───
  console.log("\n--- 2. Instant Sign In with Stored Password ---");
  const signinRes = await request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });

  assert(signinRes.status === 200, `Sign In returns HTTP 200 (got ${signinRes.status})`);
  assert(signinRes.body?.success === true, "Sign In successful with stored password");
  assert(signinRes.body?.user?.email === testEmail, "Sign In returns correct user payload");
  assert(Boolean(signinRes.body?.token), "Sign In returns valid session JWT token");

  // ─── TEST 3: INVALID PASSWORD REJECTED WITH ATTEMPTS TRACKING ───
  console.log("\n--- 3. Invalid Password Handling & Counter ---");
  const wrongPassRes = await request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "WrongPassword999!",
    }),
  });

  assert(wrongPassRes.status === 401, `Invalid password returns HTTP 401 (got ${wrongPassRes.status})`);
  assert(wrongPassRes.body?.error?.includes("remaining"), "Returns informative message with remaining attempts");

  // ─── TEST 4: OTP VERIFICATION ENDPOINT ───
  console.log("\n--- 4. OTP Verification & Single-Use Destruction ---");
  const verifyRes = await request("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      code: otpDoc.code,
    }),
  });

  assert(verifyRes.status === 200, `Verify OTP returns HTTP 200 (got ${verifyRes.status})`);
  assert(verifyRes.body?.success === true, "Verify OTP reports success");

  // ─── TEST 5: REUSED OTP REJECTED (SEC-01 & Single-Use) ───
  console.log("\n--- 5. Reused OTP Rejection (Single-Use Destruction) ---");
  const postVerifyOtpDoc = await OtpVerification.findOne({ email: testEmail, type: "signup" });
  assert(!postVerifyOtpDoc, "OTP document destroyed after single-use verification");

  const reuseRes = await request("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      code: otpDoc.code,
    }),
  });
  assert(reuseRes.status === 400, "Reused OTP rejected with HTTP 400 (SEC-01)");
  assert(!reuseRes.body?.token, "Reused OTP does not issue any session token");

  // ─── TEST 6: RESEND OTP SAFELY GENERATES FRESH CODE WITHOUT MUTATING PASSWORD ───
  console.log("\n--- 6. Resend OTP Safety ---");
  const resendRes = await request("/api/auth/resend-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      type: "signup",
    }),
  });

  assert(resendRes.status === 200, `Resend OTP returns HTTP 200 (got ${resendRes.status})`);
  assert(resendRes.body?.success === true, "Resend OTP reports success");

  const newOtpDoc = await OtpVerification.findOne({ email: testEmail });
  assert(Boolean(newOtpDoc), "Fresh OTP document created in database");

  // Confirm password was not corrupted by resend!
  const userCheckAfterResend = await User.findOne({ email: testEmail });
  const isPassStillValid = await bcrypt.compare(testPassword, userCheckAfterResend.passwordHash);
  assert(isPassStillValid === true, "User password was completely preserved and NOT overwritten by resend");

  // ─── TEST 7: FORGOT PASSWORD & PASSWORD RESET WITH OTP ───
  console.log("\n--- 7. Forgot Password & Secure Password Reset ---");
  const forgotRes = await request("/api/auth/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });

  assert(forgotRes.status === 200, `Forgot password returns HTTP 200 (got ${forgotRes.status})`);
  const resetOtpDoc = await OtpVerification.findOne({ email: testEmail, type: "reset" });
  assert(Boolean(resetOtpDoc), "Password reset OTP document created in database");

  const newPassword = "BrandNewPassword2026!Secure";
  const resetRes = await request("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      code: resetOtpDoc.code,
      newPassword,
    }),
  });

  assert(resetRes.status === 200, `Reset password returns HTTP 200 (got ${resetRes.status})`);
  assert(resetRes.body?.success === true, "Reset password succeeded");

  // Verify login with new password works
  const newSigninRes = await request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: newPassword,
    }),
  });

  assert(newSigninRes.status === 200, "Sign in with new password succeeds immediately");

  // ─── TEST 8: WRONG CODE LOCKOUT (MAX 5 ATTEMPTS THEN INVALIDATE) ───
  console.log("\n--- 8. Wrong-Code Lockout & Invalidation ---");
  const lockoutEmail = `lockout_${Date.now()}@rockgpt.local`;
  await request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Lockout Test",
      email: lockoutEmail,
      password: "Password123#Secure!",
    }),
  });

  // Attempt 4 wrong codes
  for (let i = 1; i <= 4; i++) {
    const wrongRes = await request("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: lockoutEmail, code: "000000" }),
    });
    assert(wrongRes.status === 400, `Attempt ${i}/5 rejected with 400`);
  }

  // 5th wrong attempt triggers lockout & destruction
  const fifthRes = await request("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: lockoutEmail, code: "000000" }),
  });
  assert(fifthRes.status === 429, "5th wrong attempt returns HTTP 429 Lockout");

  const lockedOtpDoc = await OtpVerification.findOne({ email: lockoutEmail, type: "signup" });
  assert(!lockedOtpDoc, "OTP invalidated and deleted after 5 failed attempts");

  // ─── TEST 9: RESEND COOLDOWN ENFORCEMENT ───
  console.log("\n--- 9. Resend Cooldown Enforcement ---");
  const cooldownKey = `email:cooldown_${Date.now()}@rockgpt.local`;
  await OtpRateLimit.create({
    key: cooldownKey,
    count: 1,
    lastSentAt: new Date(), // Sent right now
  });

  const cooldownEmail = cooldownKey.replace("email:", "");
  await User.create({
    name: "Cooldown User",
    email: cooldownEmail,
    passwordHash: "hash123",
  });

  // Temporarily toggle test bypass to verify live cooldown logic
  const cooldownRes = await request("/api/auth/resend-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-rate-limit": "true" },
    body: JSON.stringify({ email: cooldownEmail, type: "signup" }),
  });

  assert(cooldownRes.status === 429, "Resend within 60s rejected with HTTP 429 Cooldown");
  assert(cooldownRes.body?.error?.includes("wait"), "Returns wait cooldown message");

  // ─── TEST 10: 2FA TEMP-TOKEN REJECTED ON PROTECTED ROUTES (SEC-02) ───
  console.log("\n--- 10. 2FA Temporary Token Rejected on Protected Endpoints (SEC-02) ---");
  const tempToken = jwt.sign(
    { id: new mongoose.Types.ObjectId(), email: "2fa.user@rockgpt.ai", is2faPending: true, scope: "2fa_temp" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "10m" }
  );

  const protectedRes = await request("/api/auth/me", {
    headers: { Authorization: `Bearer ${tempToken}` },
  });
  assert(protectedRes.status === 403, "Protected route rejects 2FA temp-token with HTTP 403 Forbidden (SEC-02)");
  assert(protectedRes.body?.require2FA === true, "Response indicates 2FA is required");

  // ─── TEST 11: ADMIN KEY REJECTED WITH WRONG SECRET (SEC-03) ───
  console.log("\n--- 11. Admin Key Rejection (SEC-03) ---");
  const badAdminRes = await request("/api/admin/send-daily-digest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": "rockgpt-secret-2026", // old leaked secret MUST be rejected!
    },
    body: JSON.stringify({ users: [] }),
  });
  assert(badAdminRes.status === 403, "Old leaked secret 'rockgpt-secret-2026' is rejected with HTTP 403");

  const validAdminRes = await request("/api/admin/send-daily-digest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": process.env.ADMIN_SECRET,
    },
    body: JSON.stringify({ dryRun: true, users: [] }),
  });
  assert(validAdminRes.status === 200, "Valid 32+ char ADMIN_SECRET accepted with HTTP 200");

  // ─── TEST 12: CORS REJECTED ORIGIN (SEC-04) ───
  console.log("\n--- 12. Strict CORS Rejection (SEC-04) ---");
  const corsRes = await request("/api/auth/me", {
    headers: {
      Origin: "https://malicious-attacker-site.com",
    },
  });
  assert(corsRes.status === 403, "Unauthorized CORS origin rejected with HTTP 403");

  // Clean up test data
  await User.deleteMany({ email: { $in: [testEmail, lockoutEmail, cooldownEmail] } }).catch(() => {});
  await OtpVerification.deleteMany({ email: { $in: [testEmail, lockoutEmail, cooldownEmail] } }).catch(() => {});
  await OtpRateLimit.deleteMany({ key: { $regex: testEmail } }).catch(() => {});

  await stopTestServer();

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================\n");

  if (failedCount > 0) process.exit(1);
  else process.exit(0);
}

runAuthOtpTests().catch((err) => {
  console.error("FATAL Auth/OTP Test Suite Error:", err);
  process.exit(1);
});
