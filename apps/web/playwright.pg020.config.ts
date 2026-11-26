import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

export default defineConfig({
  ...base,
  testMatch: "**/dashboard/pg020-integration.spec.ts",
  workers: 1,
  webServer: [
    {
      command:
        "node ../api/scripts/run-tests.mjs --fixture tests/support/pg020-browser-server.ts",
      url: "http://127.0.0.1:5274/__pg020",
      stdout: "pipe",
      stderr: "pipe",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "pnpm build && node scripts/start.mjs",
      url: "http://127.0.0.1:5273",
      env: {
        NODE_ENV: "production",
        PORT: "5273",
        HOSTNAME: "127.0.0.1",
        API_PROXY_TARGET: "http://127.0.0.1:5274",
      },
      stdout: "pipe",
      stderr: "pipe",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
})
