import { defineConfig } from "@playwright/test"
import base from "./playwright.pg021.config"

export default defineConfig({
  ...base,
  testMatch: "**/pg022-integration.spec.ts",
  use: { ...base.use, trace: "off" },
})
