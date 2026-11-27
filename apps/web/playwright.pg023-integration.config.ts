import { defineConfig } from "@playwright/test"
import base from "./playwright.pg021.config"

export default defineConfig({
  ...base,
  testMatch: "**/pg023-integration.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:5285", trace: "off" },
  webServer: [
    {
      command:
        "node ../api/scripts/run-tests.mjs --fixture tests/support/pg023-browser-server.ts",
      url: "http://127.0.0.1:5286/__pg023",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm build && node scripts/start.mjs",
      url: "http://127.0.0.1:5285",
      env: {
        NODE_ENV: "production",
        PORT: "5285",
        HOSTNAME: "127.0.0.1",
        API_PROXY_TARGET: "http://127.0.0.1:5286",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
