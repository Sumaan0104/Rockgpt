import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://rockgpt-ten.vercel.app"),
  title: "RockGPT – Next-Gen AI Assistant & Workspace",
  description: "RockGPT is the official next-generation AI assistant for chat, code, documents and vision. Ultra-fast streaming engineered by Suman Mansuri.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
  interactiveWidget: "resizes-content",
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
