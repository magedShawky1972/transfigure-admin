import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      srcDir: "public",
      filename: "sw.js",
      strategies: "injectManifest",
      injectManifest: {
        injectionPoint: undefined
      },
      includeAssets: ["favicon.ico", "edara-logo-192.png", "edara-logo-512.png"],
      manifest: {
        name: "إدارة - Edara Admin Platform",
        short_name: "Edara",
        description: "Comprehensive admin application for Excel sheet imports, API configuration, and data management",
        theme_color: "#9b87f5",
        background_color: "#0A0A0B",
        display: "standalone",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/edara-logo-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/edara-logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
