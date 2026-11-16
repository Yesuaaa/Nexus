import { defineConfig, devices } from "@playwright/test"
import { loopbackOrigin } from "./scripts/offline-environment.mjs"

if (!process.env.CONVERYN_DEMO_ORIGIN || !process.env.CONVERYN_DEMO_PASSWORD)
  throw new Error("Use pnpm dev:system-logs-demo --verify")
export default defineConfig({
  testDir: "./e2e",
  testMatch: "system-logs-demo.spec.ts",
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 90_000,
  reporter: "line",
  outputDir: "test-results/system-logs-demo",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: loopbackOrigin(process.env.CONVERYN_DEMO_ORIGIN),
    serviceWorkers: "block",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
})
