// Shared helper for the test runners: runs a pnpm command and resolves with
// its exit status. Reuses the pnpm that launched the runner (npm_execpath),
// so `corepack pnpm test` works without pnpm on PATH.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

function resolvePnpm() {
  const launcher = process.env.npm_execpath
  if (launcher && /pnpm/i.test(launcher)) {
    return /\.(c?js|mjs)$/i.test(launcher)
      ? { command: process.execPath, prefix: [launcher], shell: false }
      : { command: launcher, prefix: [], shell: false }
  }
  const windowsPnpm = join(
    process.env.APPDATA ?? "",
    "npm",
    "node_modules",
    "pnpm",
    "pnpm.exe",
  )
  if (process.platform === "win32" && existsSync(windowsPnpm))
    return { command: windowsPnpm, prefix: [], shell: false }
  return process.platform === "win32"
    ? { command: "pnpm.cmd", prefix: [], shell: true }
    : { command: "pnpm", prefix: [], shell: false }
}

const pnpm = resolvePnpm()

/** Runs `pnpm <args>`; resolves `{ name, code, signal? }`, never rejects. */
export function runPnpm(name, args) {
  let child
  try {
    child = spawn(pnpm.command, [...pnpm.prefix, ...args], {
      env: process.env,
      shell: pnpm.shell,
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

/** Prints a summary and sets a failing exit code if any run failed. */
export function report(results) {
  const failures = results.filter((result) => result.code !== 0)
  for (const result of results) {
    const status = result.code === 0 ? "passed" : "FAILED"
    console.log(`  ${status.padEnd(6)}  ${result.name}`)
  }
  for (const failure of failures) {
    const reason = failure.signal
      ? `signal ${failure.signal}`
      : `exit code ${failure.code}`
    console.error(`${failure.name} failed with ${reason}.`)
  }
  if (failures.length > 0) process.exitCode = 1
}

export const suites = {
  api: (args = []) =>
    runPnpm("API tests", ["--filter", "@nexus/api", "test", ...args]),
  web: (args = []) =>
    runPnpm("Web unit tests", ["--filter", "@nexus/web", "test", ...args]),
  e2e: (args = []) =>
    runPnpm("Playwright", ["--filter", "@nexus/web", "test:e2e", ...args]),
}
