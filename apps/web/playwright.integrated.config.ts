import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.NEXUS_E2E_BASE_URL
if (!baseURL) throw new Error("Set NEXUS_E2E_BASE_URL for integrated E2E")

export default defineConfig({
  testDir: "./e2e-integrated",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
})
