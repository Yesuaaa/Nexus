import { defineConfig } from "@playwright/test"
import { resolve } from "node:path"

export default defineConfig({
  testDir: "..",
  testMatch: ["accounts/*.spec.ts", "auth/admin.spec.ts"],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  outputDir: resolve(
    process.cwd(),
    "../../test-results/phase7/page-by-page/page-04-account-management/playwright-final-14-rechecked",
  ),
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: resolve(
          process.cwd(),
          "../../test-results/phase7/page-by-page/page-04-account-management/playwright-final-14-rechecked-report.json",
        ),
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:5273",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
})
