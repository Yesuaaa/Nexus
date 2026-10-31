import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

const windowsPnpm = join(
  process.env.APPDATA ?? "",
  "npm",
  "node_modules",
  "pnpm",
  "pnpm.exe",
)
const packageManager =
  process.platform === "win32" && existsSync(windowsPnpm)
    ? windowsPnpm
    : process.platform === "win32"
      ? "pnpm.cmd"
      : "pnpm"
const useShellFallback =
  process.platform === "win32" && packageManager === "pnpm.cmd"
const playwrightArguments = process.argv.slice(2)

function run(name, args) {
  let child
  try {
    child = spawn(packageManager, args, {
      env: process.env,
      shell: useShellFallback,
      stdio: "inherit",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${name}] failed to start: ${message}`)
    return Promise.resolve({ code: 1, name })
  }

  return new Promise((resolve) => {
    child.once("error", (error) => {
      console.error(`[${name}] failed to start: ${error.message}`)
      resolve({ code: 1, name })
    })
    child.once("close", (code, signal) => {
      resolve({ code: code ?? 1, name, signal })
    })
  })
}

const results = await Promise.all([
  run("backend regression", ["--filter", "@nexus/api", "test:regression"]),
  run("Playwright", [
    "--filter",
    "@nexus/web",
    "test:e2e",
    ...playwrightArguments,
  ]),
])

const failures = results.filter((result) => result.code !== 0)
if (failures.length > 0) {
  for (const failure of failures) {
    const reason = failure.signal
      ? `signal ${failure.signal}`
      : `exit code ${failure.code}`
    console.error(`${failure.name} failed with ${reason}.`)
  }
  process.exitCode = 1
}
