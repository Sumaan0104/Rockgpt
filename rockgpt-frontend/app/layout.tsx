import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

const SITE_URL = (process.env.APP_URL || "https://rockgpt-ten.vercel.app").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RockGPT – Official AI Assistant & Workspace by Suman Mansuri",
    template: "%s | RockGPT",
  },
  description:
    "RockGPT (Rock GPT) is the ultra-fast, secure next-generation AI assistant by Suman Mansuri for real-time chat, software engineering, coding, mathematics, documents, and vision.",
  keywords: [
    "RockGPT",
    "Rock GPT",
    "ROCKGPT",
    "RockGPT AI",
    "RockGPT official",
    "Suman Mansuri",
    "RockGPT login",
    "AI assistant",
    "AI coding assistant",
    "AI workspace",
  ],
  authors: [{ name: "Suman Mansuri", url: `${SITE_URL}/about` }],
  creator: "Suman Mansuri",
  publisher: "RockGPT",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "RockGPT",
    title: "RockGPT – Official AI Assistant & Workspace",
    description:
      "Ultra-fast, privacy-first AI assistant engineered by Suman Mansuri for code, documents, math, research, and vision.",
    locale: "en_US",
    images: [
      {
        url: "/preview.png?v=20261125",
        width: 1200,
        height: 630,
        alt: "RockGPT – Next-Generation AI Assistant",
      },
      {
        url: "/rockgpt-logo-2026.png?v=20261125",
        width: 512,
        height: 512,
        alt: "RockGPT Brand Mark",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RockGPT – Official AI Assistant & Workspace",
    description:
      "Ultra-fast, secure AI assistant by Suman Mansuri for coding, math, vision, and deep research.",
    images: ["/preview.png?v=20261125"],
  },
  appleWebApp: {
    capable: true,
    title: "RockGPT",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=20261125", sizes: "any" },
      { url: "/favicon.svg?v=20261125", type: "image/svg+xml" },
      { url: "/favicon-48.png?v=20261125", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96.png?v=20261125", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png?v=20261125", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=20261125", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=20261125" }],
    apple: [{ url: "/apple-touch-icon.png?v=20261125", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest?v=20261125",
  other: {
    "msvalidate.01": "E94F2541019B816DCB5BDE82968FE25F",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "RockGPT",
      alternateName: ["Rock GPT", "ROCKGPT", "RockGPT AI"],
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/rockgpt-logo-2026.png?v=20261125`,
      description:
        "Official RockGPT AI workspace engineered by Suman Mansuri for high-velocity chat, software engineering, and vision.",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "RockGPT",
      alternateName: ["Rock GPT"],
      url: `${SITE_URL}/`,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/rockgpt-logo-2026.png?v=20261125`,
        width: 512,
        height: 512,
      },
      image: `${SITE_URL}/rockgpt-logo-2026.png?v=20261125`,
      founder: {
        "@type": "Person",
        name: "Suman Mansuri",
        alternateName: "Rock",
        jobTitle: "Full-Stack Software Engineer & Systems Architect",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "RockGPT",
      alternateName: ["Rock GPT"],
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web, iOS, Android, Windows, macOS",
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/rockgpt-logo-2026.png?v=20261125`,
      author: {
        "@type": "Person",
        name: "Suman Mansuri",
      },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
        { "@type": "Offer", name: "Plus", price: "149", priceCurrency: "INR" },
        { "@type": "Offer", name: "Pro", price: "399", priceCurrency: "INR" },
      ],
      featureList:
        "Real-time AI streaming, Vision image analysis, Document upload, Fast mode, Markdown & LaTeX rendering, Encrypted OTP authentication",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var root = document.documentElement;
                  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
                    root.classList.add('app-mode');
                  }
                  var t = localStorage.getItem('rockgpt_theme') || 'dark';
                  root.dataset.theme = t;
                  var s = JSON.parse(localStorage.getItem('rockgpt_set') || '{}');
                  if (s.size) root.dataset.size = s.size;
                  var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                  root.style.setProperty('--vh', h + 'px');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
