// `pnpm test:web`: runs the web unit tests in apps/web/test.
import { report, suites } from "./pnpm.mjs"

report([await suites.web(process.argv.slice(2))])
