import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security & AI Safety Policy | RockGPT",
  description:
    "Explore RockGPT cybersecurity architecture: bcrypt password hashing, single-use HMAC OTP verification, DDoS rate limiting, injection defense, and privacy guardrails.",
  alternates: { canonical: "/security" },
};

export default function SecurityPolicyPage() {
  return (
    <main className="policy-page">
      <div className="policy-shell">
        <header className="policy-top">
          <Link href="/" className="policy-brand">
            <img src="/assets/logo-sm.webp" alt="RockGPT" width={28} height={28} />
            <span>ROCKGPT</span>
          </Link>
          <nav className="policy-nav" aria-label="Policy navigation">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/security" aria-current="page">Security</Link>
            <Link href="/" className="policy-cta">Open App →</Link>
          </nav>
        </header>

        <article className="policy-body">
          <h1>Security &amp; AI Safety Architecture</h1>
          <p className="policy-updated">Last updated: November 25, 2026 · Engineered by Suman Mansuri</p>

          <section>
            <h2>1. Authentication &amp; Credential Protection</h2>
            <p>
              Passwords are salted and hashed with bcrypt (cost factor 12) before storage in MongoDB Atlas. Authentication
              routes enforce brute-force lockout (5 invalid attempts trigger a 15-minute cooldown), timing-safe HMAC-SHA256
              6-digit OTP verification, single-use OTP destruction, and rotating refresh tokens.
            </p>
          </section>

          <section>
            <h2>2. DDoS Mitigation &amp; Multi-Layer Rate Limiting</h2>
            <p>
              Traffic is protected by Vercel edge DDoS filtering alongside bounded per-IP and per-account sliding rate
              limits across signup, login, OTP resend, recovery, and streaming message endpoints.
            </p>
          </section>

          <section>
            <h2>3. Injection, XSS, &amp; CSRF Defense</h2>
            <p>
              All request payloads pass recursive prototype-pollution and NoSQL/SQL operator stripping before query
              execution. Markdown responses sanitize URLs and HTML via DOMPurify, while strict Content-Security-Policy,
              HSTS, X-Frame-Options: DENY, and CSRF Origin checks protect every browser session.
            </p>
          </section>

          <section>
            <h2>4. Personal Privacy &amp; Safety Refusals</h2>
            <p>
              RockGPT monitors requests for attempts to harvest private personal information, credentials, or
              exploitation material, refusing such queries immediately with a security and privacy notice.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
