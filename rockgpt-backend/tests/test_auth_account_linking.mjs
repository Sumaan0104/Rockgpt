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

async function runAccountLinkingTests() {
  console.log("\n==================================================");
  console.log("🧪 GMAIL DOT-INSENSITIVITY & GOOGLE ACCOUNT LINKING TEST SUITE");
  console.log("==================================================\n");

  await startTestServer();

  const timestamp = Date.now();
  // We'll test with a gmail address that has dots
  const baseUsername = `rocktest_${timestamp}`;
  const canonicalGmail = `${baseUsername}@gmail.com`;
  const dottedGmail = `${baseUsername.slice(0, 4)}.${baseUsername.slice(4)}@gmail.com`;
  const initialPassword = "StrongPassword123!";
  const newPassword = "BrandNewSecurePassword456!";

  try {
    // Clean any remnants
    await User.deleteMany({ email: { $in: [canonicalGmail, dottedGmail] } });
    await OtpVerification.deleteMany({ email: { $in: [canonicalGmail, dottedGmail] } });

    // ─── TEST 1: CREATE USER WITH CANONICAL GMAIL ───
    console.log("--- 1. Register Account with Canonical Gmail ---");
    const regRes = await request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: canonicalGmail,
        password: initialPassword,
      }),
    });

    assert(regRes.status === 200, `Signup returned HTTP 200 (got ${regRes.status})`);
    assert(regRes.body?.success === true, "Signup reports success");

    // ─── TEST 2: SIGN IN USING DOTTED GMAIL VARIANT ───
    console.log("\n--- 2. Sign In Using Dotted Gmail Variant ---");
    const dotSignInRes = await request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dottedGmail,
        password: initialPassword,
      }),
    });

    assert(dotSignInRes.status === 200, `Sign In with dotted variant returned HTTP 200 (got ${dotSignInRes.status})`);
    assert(dotSignInRes.body?.success === true, "Sign In with dotted variant succeeded");
    assert(Boolean(dotSignInRes.body?.token), "Sign In returns valid session token");

    // ─── TEST 3: FORGOT PASSWORD USING DOTTED GMAIL VARIANT ───
    console.log("\n--- 3. Forgot Password Request for Dotted Variant ---");
    const forgotRes = await request("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dottedGmail,
      }),
    });

    assert(forgotRes.status === 200, `Forgot password returned HTTP 200 (got ${forgotRes.status})`);
    assert(forgotRes.body?.success === true, "Forgot password reports success");

    const resetOtp = await OtpVerification.findOne({
      email: { $in: [canonicalGmail, dottedGmail] },
      type: "reset",
    });
    assert(Boolean(resetOtp), "Password reset OTP document created in database");
    assert(/^\d{6}$/.test(resetOtp?.code || ""), "OTP code is a valid 6-digit number");

    // ─── TEST 4: RESET PASSWORD USING DOTTED VARIANT ───
    console.log("\n--- 4. Reset Password with OTP and New Password ---");
    const resetRes = await request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dottedGmail,
        code: resetOtp.code,
        newPassword,
      }),
    });

    assert(resetRes.status === 200, `Reset password returned HTTP 200 (got ${resetRes.status})`);
    assert(resetRes.body?.success === true, "Password reset succeeded");

    // Verify new password works with BOTH canonical and dotted email
    const loginCanonicalNew = await request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: canonicalGmail,
        password: newPassword,
      }),
    });
    assert(loginCanonicalNew.status === 200, "Sign in with canonical email and new password succeeded");

    const loginDottedNew = await request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dottedGmail,
        password: newPassword,
      }),
    });
    assert(loginDottedNew.status === 200, "Sign in with dotted email and new password succeeded");

    // ─── TEST 5: GOOGLE-REGISTERED ACCOUNT WITHOUT PASSWORD ───
    console.log("\n--- 5. Google Account Detection & Password Set Flow ---");
    const googleUserEmail = `googleuser_${timestamp}@gmail.com`;
    const googleUserDotted = `google.user_${timestamp}@gmail.com`;

    // Create user simulating Google Sign-In (googleId present, passwordHash is null)
    await User.create({
      name: "Google Account User",
      email: googleUserEmail,
      googleId: `google_sub_${timestamp}`,
      passwordHash: null,
      password: null,
      plan: "free",
    });

    // Attempt email/password sign-in with Google account
    const googleSignInAttempt = await request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: googleUserDotted,
        password: "AnyPassword123!",
      }),
    });

    assert(googleSignInAttempt.status === 401, `Google account signin attempt returns HTTP 401 (got ${googleSignInAttempt.status})`);
    assert(googleSignInAttempt.body?.isGoogleAccount === true, "Response flags isGoogleAccount: true");
    assert(googleSignInAttempt.body?.error?.includes("Google Sign-In"), "Response explicitly mentions account was registered with Google Sign-In");

    // Now request Forgot Password for Google account
    const googleForgotRes = await request("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: googleUserDotted,
      }),
    });

    assert(googleForgotRes.status === 200, `Forgot password for Google account returned HTTP 200 (got ${googleForgotRes.status})`);
    assert(googleForgotRes.body?.success === true, "OTP generated for Google account");

    const googleOtpDoc = await OtpVerification.findOne({
      email: { $in: [googleUserEmail, googleUserDotted] },
      type: "reset",
    });
    assert(Boolean(googleOtpDoc), "OTP document found for Google account");

    // Set password on Google account
    const setPassRes = await request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: googleUserDotted,
        code: googleOtpDoc.code,
        newPassword: "GoogleUserPassword789!",
      }),
    });

    assert(setPassRes.status === 200, `Set password returned HTTP 200 (got ${setPassRes.status})`);
    assert(setPassRes.body?.success === true, "Password successfully set for Google account");

    // Verify Google account can now sign in using password!
    const googlePassLoginRes = await request("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: googleUserDotted,
        password: "GoogleUserPassword789!",
      }),
    });

    assert(googlePassLoginRes.status === 200, `Google account can now sign in with password! HTTP 200 (got ${googlePassLoginRes.status})`);
    assert(Boolean(googlePassLoginRes.body?.token), "Valid session token returned for newly set password");

    // Verify user document in MongoDB has both googleId AND passwordHash
    const updatedGoogleUser = await User.findOne({ email: googleUserEmail });
    assert(Boolean(updatedGoogleUser.googleId), "User retains googleId");
    assert(Boolean(updatedGoogleUser.passwordHash), "User now has secure bcrypt passwordHash stored in database");

    // ─── TEST 6: NON-EXISTENT ACCOUNT BEHAVIOR ───
    console.log("\n--- 6. Truly Non-Existent Account Error Handling ---");
    const nonExistentForgot = await request("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `definitely_does_not_exist_${timestamp}@example.com`,
      }),
    });

    assert(nonExistentForgot.status === 404, `Non-existent email returns HTTP 404 (got ${nonExistentForgot.status})`);
    assert(nonExistentForgot.body?.error?.includes("No account found"), "Returns clear error: No account found with this email address");

    // Cleanup
    await User.deleteMany({ email: { $in: [canonicalGmail, dottedGmail, googleUserEmail, googleUserDotted] } });
    await OtpVerification.deleteMany({ email: { $in: [canonicalGmail, dottedGmail, googleUserEmail, googleUserDotted] } });

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("==================================================\n");
  } catch (err) {
    console.error("Test execution error:", err);
    failedCount++;
  } finally {
    await stopTestServer();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runAccountLinkingTests();
