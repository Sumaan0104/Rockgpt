import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";

const { default: app } = await import("../server.js");
const { default: User } = await import("../models/User.js");
const { default: OtpVerification } = await import("../models/OtpVerification.js");

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
  console.log("🧪 ROCKGPT AUTHENTICATION, PASSWORD STORAGE & OTP TEST SUITE");
  console.log("==================================================\n");

  await startTestServer();

  const testEmail = `testuser_${Date.now()}@rockgpt.local`;
  const testPassword = "Password123#Secure!";
  const testName = "Suman Test User";

  // Clean any prior artifacts
  await User.deleteMany({ email: testEmail }).catch(() => {});
  await OtpVerification.deleteMany({ email: testEmail }).catch(() => {});

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

  // Verify OTP verification record exists
  const otpDoc = await OtpVerification.findOne({ email: testEmail, type: "signup" });
  assert(Boolean(otpDoc), "6-digit OTP verification document created in OtpVerification collection");
  assert(Boolean(otpDoc?.code) && otpDoc.code.length === 6, "OTP code is a valid 6-digit cryptographic string");

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

  // Verify single-use destruction: OTP doc should now be deleted
  const postVerifyOtpDoc = await OtpVerification.findOne({ email: testEmail });
  assert(!postVerifyOtpDoc, "OTP document destroyed after single-use verification");

  // ─── TEST 5: RESEND OTP SAFELY GENERATES FRESH CODE WITHOUT MUTATING PASSWORD ───
  console.log("\n--- 5. Resend OTP Safety ---");
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

  // ─── TEST 6: FORGOT PASSWORD & PASSWORD RESET WITH OTP ───
  console.log("\n--- 6. Forgot Password & Secure Password Reset ---");
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

  // ─── TEST 7: LEGACY PLAINTEXT PASSWORD AUTO-MIGRATION ───
  console.log("\n--- 7. Legacy Password Auto-Migration to Bcrypt ---");
  const legacyEmail = `legacy_${Date.now()}@rockgpt.local`;
  const legacyPassword = "OldLegacyPassword123!";

  await User.create({
    name: "Legacy User",
    email: legacyEmail,
    password: legacyPassword,
    passwordHash: null,
  });

  const legacySigninRes = await request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: legacyEmail,
      password: legacyPassword,
    }),
  });

  assert(legacySigninRes.status === 200, "Legacy user can sign in with stored legacy password");

  const migratedUser = await User.findOne({ email: legacyEmail });
  assert(Boolean(migratedUser.passwordHash), "Legacy password automatically migrated to bcrypt passwordHash");
  assert(migratedUser.password === null, "Plaintext legacy password erased from database");

  // Clean up test data
  await User.deleteMany({ email: { $in: [testEmail, legacyEmail] } }).catch(() => {});
  await OtpVerification.deleteMany({ email: { $in: [testEmail, legacyEmail] } }).catch(() => {});

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
