import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const credentialsPath = fileURLToPath(
  new URL(".env.regression.local", import.meta.url),
)
if (existsSync(credentialsPath)) process.loadEnvFile(credentialsPath)
const live = process.env.NEXUS_E2E_LIVE === "1"
const baseURL = process.env.NEXUS_E2E_BASE_URL || "http://127.0.0.1:5273"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: live ? 1 : undefined,
  use: {
    baseURL,
    trace: live ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: process.env.NEXUS_E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/start.mjs",
        url: "http://127.0.0.1:5273",
        env: { PORT: "5273", HOSTNAME: "127.0.0.1" },
        reuseExistingServer: !process.env.CI,
      },
})
