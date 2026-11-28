import { defineConfig } from "@playwright/test"
import base from "./playwright.pg021.config"

export default defineConfig({
  ...base,
  testMatch: "**/pg026-integration.spec.ts",
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:5295",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command:
        "node ../api/scripts/run-tests.mjs --fixture tests/support/pg026-browser-server.ts",
      url: "http://127.0.0.1:5296/__pg026",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SESSION_GEOLOCATION: "off", TRUST_PROXY: "" },
    },
    {
      command: "pnpm build && node scripts/start.mjs",
      url: "http://127.0.0.1:5295",
      env: {
        NODE_ENV: "production",
        PORT: "5295",
        HOSTNAME: "127.0.0.1",
        API_PROXY_TARGET: "http://127.0.0.1:5296",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
