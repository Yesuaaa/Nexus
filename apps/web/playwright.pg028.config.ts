import { defineConfig } from "@playwright/test"
import base from "./playwright.pg021.config"

export default defineConfig({
  ...base,
  testMatch: "**/pg028-messages.spec.ts",
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:5299",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command:
        "node ../api/scripts/run-tests.mjs --fixture tests/support/pg028-browser-server.ts",
      url: "http://127.0.0.1:5300/__pg028",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SESSION_GEOLOCATION: "off", TRUST_PROXY: "" },
    },
    {
      command: "pnpm build && node scripts/start.mjs",
      url: "http://127.0.0.1:5299",
      env: {
        NODE_ENV: "production",
        PORT: "5299",
        HOSTNAME: "127.0.0.1",
        API_PROXY_TARGET: "http://127.0.0.1:5300",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
