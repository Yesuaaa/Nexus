import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const result = spawnSync(
  process.execPath,
  [
    require.resolve("@playwright/test/cli"),
    "test",
    "regression.spec.ts",
    "--grep",
    "live test accounts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, NEXUS_E2E_LIVE: "1" } },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
