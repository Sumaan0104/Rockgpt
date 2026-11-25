import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | RockGPT",
  description:
    "How RockGPT collects, encrypts, protects, and manages your account credentials, OTP verification, and conversation history in MongoDB.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="policy-page">
      <div className="policy-shell">
        <header className="policy-top">
          <Link href="/" className="policy-brand">
            <img src="/assets/logo-sm.webp?v=20261125" alt="RockGPT" width={28} height={28} />
            <span>ROCKGPT</span>
          </Link>
          <nav className="policy-nav" aria-label="Policy navigation">
            <Link href="/privacy" aria-current="page">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/security">Security</Link>
            <Link href="/" className="policy-cta">Open App →</Link>
          </nav>
        </header>

        <article className="policy-body">
          <h1>Privacy Policy</h1>
          <p className="policy-updated">Last updated: November 25, 2026 · Engineered by Suman Mansuri</p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>
              When you register for a RockGPT account, we store only your full name, normalized email address,
              bcrypt-hashed password (never plaintext), optional preferences (custom instructions, Fast mode, text size),
              and your conversation history in our isolated MongoDB Atlas database.
            </p>
          </section>

          <section>
            <h2>2. 3-Minute Guest Preview &amp; Cookies</h2>
            <p>
              Unauthenticated visitors receive a 3-minute (180-second) preview enforced via a cryptographically signed
              HTTP-only session cookie. Once signed in, RockGPT maintains an HTTP-only, SameSite-protected session token
              so your chats remain accessible across devices.
            </p>
          </section>

          <section>
            <h2>3. Email &amp; One-Time Password (OTP) Security</h2>
            <p>
              Every registration and password recovery code is generated using cryptographic randomness, stored strictly as
              a single-use HMAC-SHA256 hash expiring in 10 minutes, and delivered over encrypted transport solely to verify
              ownership of your email address.
            </p>
          </section>

          <section>
            <h2>4. Data Isolation &amp; Deletion Control</h2>
            <p>
              Every chat, message, and preference query is strictly scoped to your verified user ID on the server. You may
              export all conversations as JSON/Markdown or delete individual chats and entire histories at any time from
              Settings. Soft-deleted chats are recoverable for 6 seconds via Undo and permanently purged after 7 days.
            </p>
          </section>

          <section>
            <h2>5. Personal Privacy Guardrails</h2>
            <p>
              RockGPT refuses requests seeking private personal information (phone numbers, residential addresses, personal
              identities, credentials, or confidential data) to uphold user and platform privacy.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
