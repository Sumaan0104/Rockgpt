import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "RockGPT",
        short_name: "RockGPT",
        description: "RockGPT — your personal AI assistant",
        theme_color: "#0b0b0b",
        background_color: "#0b0b0b",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/remark") ||
            id.includes("node_modules/rehype") ||
            id.includes("node_modules/micromark") ||
            id.includes("node_modules/unist") ||
            id.includes("node_modules/vfile")
          ) {
            return "vendor-markdown";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
});