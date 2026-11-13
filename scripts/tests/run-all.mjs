// `pnpm test`: every suite, one after another so output stays readable.
// Runs API tests, web unit tests, then Playwright; a failing suite doesn't
// stop the rest. `pnpm test:unit` (or `--no-e2e`) skips Playwright.
import { report, suites } from "./pnpm.mjs"

const skipE2e = process.argv.includes("--no-e2e")
const order = skipE2e ? ["api", "web"] : ["api", "web", "e2e"]

const results = []
for (const suite of order) {
  console.log(`\n=== ${suite} ===`)
  results.push(await suites[suite]())
}

console.log("\nTest summary")
report(results)
