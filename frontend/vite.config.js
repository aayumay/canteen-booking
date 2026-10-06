import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Split the vendor libraries into their own long-lived chunks.
 *
 * The app entry was ~567 kB minified in one file, which meant every app deploy
 * invalidated React, React Query, Framer Motion, Sentry and the router in the
 * user's cache. Separating them means those files only change when the library
 * itself does, and the browser can fetch them in parallel.
 */
function manualChunks(id) {
  if (!id.includes("node_modules")) return undefined;

  if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) {
    return "vendor-react";
  }
  if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
    return "vendor-motion";
  }
  if (id.includes("@tanstack")) return "vendor-query";
  if (id.includes("@sentry")) return "vendor-sentry";
  if (id.includes("axios") || id.includes("follow-redirects")) return "vendor-net";
  if (id.includes("canvas-confetti") || id.includes("qrcode.react")) return "vendor-extras";
  // The scanner is only reachable from the lazy /vendor/scan route, but
  // html5-qrcode is ~110 kB gzipped. Without its own bucket it would be merged
  // into vendor-extras, which index.html modulepreloads — charging every
  // visitor for a camera decoder they never load.
  if (id.includes("html5-qrcode")) return "vendor-qrscan";
  // Anything unmatched is left to Rollup rather than forced into a bucket —
  // an explicit catch-all here just emits an empty chunk.
  return undefined;
}

// The dev proxy has to reach the FastAPI backend. When running uvicorn
// directly on the host that is port 8000; the committed Docker setup maps the
// container's 8000 onto the host's 8080 instead, so the target is overridable
// rather than hardcoded to whichever one this project happened to use.
// Only affects `npm run dev` - the production build is served through nginx.
const API_TARGET = process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  // tailwindcss emits nothing on its own; the utilities are only generated for
  // the scrapbook stylesheet, which opts in via @import. The rest of the app
  // keeps its hand-written CSS and is unaffected.
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: 5173,
    // Bind every interface, not just loopback. Without this the dev server
    // listens on ::1 only and is unreachable from a phone on the same Wi-Fi,
    // which is the usual reason "npm run dev" works on the laptop and shows
    // "connection refused" on a real device.
    // Set VITE_DEV_HOST=false to keep it loopback-only.
    host: process.env.VITE_DEV_HOST !== "false",
    strictPort: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/uploads": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
