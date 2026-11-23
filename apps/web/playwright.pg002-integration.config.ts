import { defineConfig, devices } from "@playwright/test"

const baseURL = "http://127.0.0.1:5274"
const apiFixtureCommand =
  "pnpm --filter @nexus/api exec prisma generate && " +
  "pnpm --filter @nexus/api exec tsx tests/support/pg002-browser-fixture.ts"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/accounts/pg002-integration.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: [
    {
      command: apiFixtureCommand,
      url: "http://127.0.0.1:31372/ready",
      env: {
        PG002_API_PORT: "31371",
        PG002_CONTROL_PORT: "31372",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm build && node scripts/start.mjs",
      url: baseURL,
      env: {
        API_PROXY_TARGET: "http://127.0.0.1:31371",
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        PORT: "5274",
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
