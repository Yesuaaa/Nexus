import { defineConfig, devices } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { loopbackOrigin } from "./scripts/offline-environment.mjs"

// Isolated configuration: never import the live-capable regression config or env.
if (
  !process.env.SYSTEM_LOGS_OFFLINE_MANIFEST ||
  !process.env.SYSTEM_LOGS_OFFLINE_OUTPUT
)
  throw new Error(
    "Use pnpm test:system-logs-integration to own offline infrastructure",
  )
const fixture = JSON.parse(
  readFileSync(process.env.SYSTEM_LOGS_OFFLINE_MANIFEST, "utf8"),
) as { webOrigin: string; nativeWorker: boolean }
if (fixture.nativeWorker !== true)
  throw new Error("Native offline fixture required")
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  reporter: "line",
  outputDir: path.join(process.env.SYSTEM_LOGS_OFFLINE_OUTPUT, "browser"),
  use: {
    ...devices["Desktop Chrome"],
    baseURL: loopbackOrigin(fixture.webOrigin),
    serviceWorkers: "block",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: ["express-forwarded", "next-rewrite", "frontend-fixtures"].map(
    (name) => ({
      name,
      testMatch:
        name === "frontend-fixtures"
          ? /(?:system-logs|error-logs|system-health)\.spec\.ts/
          : "system-logs-integration.spec.ts",
      use: { extraHTTPHeaders: { "x-system-logs-offline-transport": name } },
    }),
  ),
})
