import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The Vite dev server is the single public entry point: it serves the site
// and proxies /api to the KLYRO Studio OS backend (server/index.mjs).
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.KLYRO_API_TARGET || "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.mjs", "src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 20000,
  },
});
