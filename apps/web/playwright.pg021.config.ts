import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

export default defineConfig({
  ...base,
  testDir: "./e2e-integrated",
  testMatch: "**/pg021-integration.spec.ts",
  workers: 1,
  retries: 0,
  use: { ...base.use, baseURL: "http://127.0.0.1:5283" },
  webServer: [
    {
      command:
        "node ../api/scripts/run-tests.mjs --fixture tests/support/pg021-browser-server.ts",
      url: "http://127.0.0.1:5284/__pg021",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm build && node scripts/start.mjs",
      url: "http://127.0.0.1:5283",
      env: {
        NODE_ENV: "production",
        PORT: "5283",
        HOSTNAME: "127.0.0.1",
        API_PROXY_TARGET: "http://127.0.0.1:5284",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
