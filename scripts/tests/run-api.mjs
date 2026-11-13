// `pnpm test:api`: typechecks and runs every apps/api/tests/**/*.test.ts
// against in-memory PGlite (never a live database).
import { report, suites } from "./pnpm.mjs"

report([await suites.api(process.argv.slice(2))])
