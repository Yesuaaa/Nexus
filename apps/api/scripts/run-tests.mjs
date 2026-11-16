// Compile the existing test tree once, then use native Node. This avoids tsx's
// OS-user/IPC startup dependency in restricted Windows environments.
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, cp, realpath } from "node:fs/promises"
import { rmSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const requireApi = createRequire(join(apiRoot, "package.json"))

function run(args, cwd) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: "inherit",
      windowsHide: true,
    })
    child.once("error", reject)
    child.once("exit", (code) => resolveExit(code ?? 1))
  })
}

const buildRoot = join(apiRoot, ".test-build")
await mkdir(buildRoot, { recursive: true })
const resolvedApi = await realpath(apiRoot)
const resolvedBuild = await realpath(buildRoot)
const buildRelative = relative(resolvedApi, resolvedBuild)
if (
  !buildRelative ||
  buildRelative.startsWith("..") ||
  isAbsolute(buildRelative)
)
  throw new Error("Test build directory must remain inside the API workspace")
const runRoot = await mkdtemp(join(resolvedBuild, "run-"))
const compiledApi = join(runRoot, "apps/api")
// Only this invocation's generated directory can be removed. Fixtures run in
// this process, so Playwright teardown cannot leave a child API server running.
process.once("exit", () => {
  const target = resolve(runRoot)
  if (
    dirname(target) !== resolvedBuild ||
    !target.startsWith(join(resolvedBuild, "run-"))
  )
    throw new Error("Unexpected test build cleanup target")
  rmSync(target, { recursive: true, force: true })
})

const compileCode = await run(
  [
    requireApi.resolve("typescript/bin/tsc"),
    "-p",
    "tests/tsconfig.json",
    "--noEmit",
    "false",
    "--outDir",
    compiledApi,
  ],
  apiRoot,
)
if (compileCode !== 0) process.exit(compileCode)

// Preserve the source tree's relative asset paths without modifying the harness
// or production database TLS configuration. No environment credentials are copied.
await cp(
  join(apiRoot, "prisma/migrations"),
  join(compiledApi, "prisma/migrations"),
  { recursive: true },
)
await cp(
  join(apiRoot, "../../certs/supabase-root-2021.crt"),
  join(runRoot, "certs/supabase-root-2021.crt"),
)
const args = process.argv.slice(2)
// Only the explicit PostgreSQL fixture requires this operator asset. Ordinary
// API tests (including app-only Docker checkouts) keep their existing inputs.
if (args.includes("tests/support/management-history-postgres.ts"))
  await cp(
    join(apiRoot, "../../docs/operations/system-logs-privilege-inspection.sql"),
    join(compiledApi, "tests/support/system-logs-privilege-inspection.sql"),
  )
if (args[0] === "--fixture") {
  const entry = args[1]
  if (args.length !== 2 || !/^tests\/support\/[\w-]+\.ts$/.test(entry ?? ""))
    throw new Error("Choose a fixture in tests/support")
  await import(
    pathToFileURL(join(compiledApi, entry.replace(/\.ts$/, ".js"))).href
  )
} else {
  const testArgs = args.length ? args : ["tests/**/*.test.ts"]
  process.exitCode = await run(
    [
      "--test",
      "--test-concurrency=2",
      ...testArgs.map((arg) =>
        arg.endsWith(".ts") ? arg.replace(/\.ts$/, ".js") : arg,
      ),
    ],
    compiledApi,
  )
}
