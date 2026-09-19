import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_ENV = "test";

const { app, setGoogleOAuthClientForTesting } = await import("../server.js");
const { default: User } = await import("../models/User.js");

// Mock Google OAuth Client
class MockOAuth2Client {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  async getToken(code) {
    if (code === "invalid_or_expired_code") {
      const err = new Error("invalid_grant: Bad Request");
      err.response = { data: { error: "invalid_grant" } };
      throw err;
    }
    if (code === "no_id_token_code") {
      return { tokens: {} };
    }
    return {
      tokens: {
        id_token: `mock_id_token_for_${code}`,
        access_token: "mock_access_token",
      },
    };
  }

  async verifyIdToken({ idToken, audience }) {
    if (idToken.includes("unverified_email")) {
      return {
        getPayload: () => ({
          sub: "google_unverified_101",
          email: "unverified@gmail.com",
          email_verified: false,
          name: "Unverified User",
        }),
      };
    }

    if (idToken.includes("totp_user")) {
      return {
        getPayload: () => ({
          sub: "google_totp_202",
          email: "totp_user@gmail.com",
          email_verified: true,
          name: "TOTP User",
          picture: "https://avatar.test/totp",
        }),
      };
    }

    if (idToken.includes("linking_legacy_user")) {
      return {
        getPayload: () => ({
          sub: "google_legacy_303",
          email: "legacy_user@gmail.com",
          email_verified: true,
          name: "Legacy Linked User",
          picture: "https://avatar.test/legacy",
        }),
      };
    }

    if (idToken.includes("existing_google_user")) {
      return {
        getPayload: () => ({
          sub: "google_existing_404",
          email: "existing_google@gmail.com",
          email_verified: true,
          name: "Existing Google User",
          picture: "https://avatar.test/existing",
        }),
      };
    }

    if (idToken.includes("new_verified_user")) {
      return {
        getPayload: () => ({
          sub: "google_new_505",
          email: "new_verified_user@gmail.com",
          email_verified: true,
          name: "Brand New User",
          picture: "https://avatar.test/new",
        }),
      };
    }

    throw new Error("Invalid ID token signature");
  }
}

async function runTests() {
  console.log("\n🧪 STARTING GOOGLE OAUTH 2.0 AUTOMATED TEST SUITE\n");

  // Check if live MongoDB connection is available
  let useLiveDb = false;
  let attempts = 0;
  while (mongoose.connection.readyState !== 1 && attempts < 5) {
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }

  if (mongoose.connection.readyState === 1) {
    useLiveDb = true;
    console.log("✓ Using live MongoDB connection.");
  } else {
    console.log("ℹ Remote MongoDB not reachable in local environment; using robust in-memory mock store.");
    // In-memory store fallback for offline/isolated environments
    const inMemoryStore = new Map();
    let idCounter = 1;

    const originalFindOne = User.findOne;
    const originalCreate = User.create;
    const originalCountDocuments = User.countDocuments;
    const originalDeleteMany = User.deleteMany;

    User.findOne = async function(query) {
      for (const u of inMemoryStore.values()) {
        if (query.googleId && u.googleId === query.googleId) return u;
        if (query.email && u.email === query.email) return u;
        if (query._id && String(u._id) === String(query._id)) return u;
      }
      return null;
    };

    User.create = async function(doc) {
      const id = new mongoose.Types.ObjectId();
      const user = new User({ ...doc, _id: id });
      inMemoryStore.set(String(id), user);
      return user;
    };

    User.countDocuments = async function(query) {
      let count = 0;
      for (const u of inMemoryStore.values()) {
        if (query.email && u.email === query.email) count++;
      }
      return count;
    };

    User.deleteMany = async function(query) {
      if (query?.email?.$in) {
        for (const [id, u] of inMemoryStore.entries()) {
          if (query.email.$in.includes(u.email)) {
            inMemoryStore.delete(id);
          }
        }
      }
    };

    const origSave = User.prototype.save;
    User.prototype.save = async function() {
      if (!this._id) {
        this._id = new mongoose.Types.ObjectId();
      }
      inMemoryStore.set(String(this._id), this);
      return this;
    };
  }

  // Set mock OAuth client
  const mockClient = new MockOAuth2Client("test_client_id", "test_secret", "postmessage");
  setGoogleOAuthClientForTesting(mockClient);

  // Bind server to ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  };

  try {
    const testEmails = [
      "new_verified_user@gmail.com",
      "existing_google@gmail.com",
      "unverified@gmail.com",
      "totp_user@gmail.com",
      "legacy_user@gmail.com",
    ];
    await User.deleteMany({ email: { $in: testEmails } });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 1: New verified Google user creation
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Scenario 1: New Verified Google User Creation ---");
    const res1 = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "new_verified_user" }),
    });
    const data1 = await res1.json();

    assert(res1.status === 200, "Returns HTTP 200 OK");
    assert(Boolean(data1.token), "Issues valid JWT session token");
    assert(data1.user?.email === "new_verified_user@gmail.com", "Sets user email correctly");
    assert(data1.user?.plan === "Free", "Assigns default Free plan");

    const dbUser1 = await User.findOne({ email: "new_verified_user@gmail.com" });
    assert(Boolean(dbUser1), "User persisted in database");
    assert(dbUser1?.googleId === "google_new_505", "googleId stored on User model");

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 2: Existing Google user login
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Scenario 2: Existing Google User Login ---");
    await User.create({
      name: "Existing Google User",
      email: "existing_google@gmail.com",
      googleId: "google_existing_404",
      plan: "Pro",
    });

    const res2 = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "existing_google_user" }),
    });
    const data2 = await res2.json();

    assert(res2.status === 200, "Returns HTTP 200 OK");
    assert(Boolean(data2.token), "Issues JWT session token");
    assert(data2.user?.email === "existing_google@gmail.com", "Matches existing user email");
    assert(data2.user?.plan === "Pro", "Preserves existing user plan (Pro)");

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 3: Unverified email rejection
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Scenario 3: Unverified Email Rejection ---");
    const res3 = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "unverified_email" }),
    });
    const data3 = await res3.json();

    assert(res3.status === 400, "Rejects unverified email with HTTP 400 Bad Request");
    assert(
      data3.error?.toLowerCase().includes("not verified"),
      `Error explains email is unverified (received: "${data3.error}")`
    );

    const dbUnverified = await User.findOne({ email: "unverified@gmail.com" });
    assert(!dbUnverified, "Unverified user is NOT created in database");

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 4: Invalid / expired authorization code rejection
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Scenario 4: Invalid / Expired Authorization Code ---");
    const res4 = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "invalid_or_expired_code" }),
    });
    const data4 = await res4.json();

    assert(res4.status === 400, "Rejects invalid code with HTTP 400");
    assert(
      data4.error?.toLowerCase().includes("invalid or expired"),
      `Returns safe generic error (received: "${data4.error}")`
    );

    const res4Missing = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(res4Missing.status === 400, "Rejects empty body with HTTP 400");

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 5: Existing user with TOTP 2FA enabled
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Scenario 5: Existing User With TOTP 2FA Enabled ---");
    await User.create({
      name: "TOTP User",
      email: "totp_user@gmail.com",
      googleId: "google_totp_202",
      twoFactorEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
      plan: "Free",
    });

    const res5 = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "totp_user" }),
    });
    const data5 = await res5.json();

    assert(res5.status === 200, "Returns HTTP 200");
    assert(data5.require2FA === true, "Enforces require2FA === true");
    assert(Boolean(data5.tempToken), "Returns temporary 2FA verification token");
    assert(!data5.token, "Does NOT issue main JWT session token before 2FA verification");

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 6: Duplicate-account prevention (Safe account linking)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Scenario 6: Duplicate-Account Prevention (Safe Linking) ---");
    await User.create({
      name: "Legacy Account",
      email: "legacy_user@gmail.com",
      password: "$2a$10$abcdefghijklmnopqrstuv",
      plan: "Free",
    });

    const res6 = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "linking_legacy_user" }),
    });
    const data6 = await res6.json();

    assert(res6.status === 200, "Returns HTTP 200 OK");
    assert(Boolean(data6.token), "Issues JWT session token");
    assert(data6.user?.email === "legacy_user@gmail.com", "Matches existing user email");

    const legacyUserCount = await User.countDocuments({ email: "legacy_user@gmail.com" });
    assert(legacyUserCount === 1, "Exactly ONE account exists (zero duplicates created)");

    const linkedUser = await User.findOne({ email: "legacy_user@gmail.com" });
    assert(linkedUser?.googleId === "google_legacy_303", "Attached googleId to existing account");
    assert(Boolean(linkedUser?.password), "Preserved existing password for email/password login");

    await User.deleteMany({ email: { $in: testEmails } });
  } finally {
    await new Promise((r) => server.close(r));
    if (useLiveDb) {
      await mongoose.connection.close();
    }
  }

  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
