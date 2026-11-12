// `pnpm test:e2e`: the offline backend regression suite and the Playwright
// browser suite, in parallel. Extra arguments go to Playwright
// (e.g. `pnpm test:e2e -- --ui`).
import { report, runPnpm, suites } from "./pnpm.mjs"

const results = await Promise.all([
  runPnpm("Backend regression", ["--filter", "@nexus/api", "test:regression"]),
  suites.e2e(process.argv.slice(2)),
])

report(results)
