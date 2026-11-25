import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | RockGPT",
  description:
    "Terms of Service governing the RockGPT AI assistant, 3-minute guest preview, verified accounts, Plus/Pro subscriptions, and acceptable use.",
  alternates: { canonical: "/terms" },
};

export default function TermsOfServicePage() {
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
            <Link href="/terms" aria-current="page">Terms</Link>
            <Link href="/security">Security</Link>
            <Link href="/" className="policy-cta">Open App →</Link>
          </nav>
        </header>

        <article className="policy-body">
          <h1>Terms of Service</h1>
          <p className="policy-updated">Last updated: November 25, 2026 · Engineered by Suman Mansuri</p>

          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or creating an account on RockGPT (<strong>https://rockgpt-ten.vercel.app</strong>), you agree
              to comply with these Terms of Service and all applicable laws.
            </p>
          </section>

          <section>
            <h2>2. Free Trial &amp; User Accounts</h2>
            <p>
              Guests may try RockGPT during a 3-minute preview session. Continued access requires creating and verifying
              an account via email OTP or Google OAuth. You are responsible for safeguarding your account password and
              ensuring your account details remain accurate.
            </p>
          </section>

          <section>
            <h2>3. Plans &amp; Billing (Free, Plus, Pro)</h2>
            <p>
              RockGPT offers a Free tier (standard chat, document/image analysis), Plus (₹149/month for priority routing
              and expanded file uploads), and Pro (₹399/month for unlimited high-speed inference). Paid upgrades via UPI
              are activated upon payment verification.
            </p>
          </section>

          <section>
            <h2>4. Acceptable Use</h2>
            <p>
              You agree not to use RockGPT to automate denial-of-service floods, bypass authentication or rate limits,
              probe for injection vulnerabilities, extract private user PII, generate malicious exploits, or impersonate
              other individuals. Accounts violating rate limits or security controls may be temporarily locked.
            </p>
          </section>

          <section>
            <h2>5. Accuracy Disclaimer</h2>
            <p>
              AI responses are generated for informational and engineering productivity purposes. Always verify critical
              financial, medical, legal, and production deployment outputs before acting on them.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
