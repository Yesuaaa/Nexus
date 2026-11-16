import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import path from "node:path"
import {
  offlineEnvironment,
  pnpmInvocation,
  loopbackOrigin,
} from "../../apps/web/scripts/offline-environment.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const webRoot = path.join(root, "apps/web")
const pnpm = pnpmInvocation()
const args = process.argv.slice(2)
const verify = args.includes("--verify")
const portIndex = args.indexOf("--port")
const portText = portIndex === -1 ? "5174" : args[portIndex + 1]
const port = Number(portText)
if (
  (process.env.NODE_ENV !== undefined &&
    process.env.NODE_ENV !== "development") ||
  process.env.NODE_TEST_CONTEXT !== undefined
)
  throw new Error(
    "Local demonstration cannot run in production or a test worker",
  )
if (
  !/^\d+$/.test(portText ?? "") ||
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535 ||
  args.filter((arg) => arg === "--port").length > 1 ||
  args.filter((arg) => arg === "--verify").length > 1 ||
  args.some(
    (arg, i) =>
      arg !== "--verify" &&
      arg !== "--port" &&
      !(portIndex >= 0 && i === portIndex + 1),
  )
)
  throw new Error("Usage: pnpm dev:system-logs-demo [--port 5174] [--verify]")
const webOrigin = loopbackOrigin(`http://127.0.0.1:${port}`)
// Fail on a busy port instead of forwarding users to an unrelated running app.
const reservation = createServer()
await new Promise((resolve, reject) => {
  reservation.once("error", reject)
  reservation.listen(port, "127.0.0.1", resolve)
})
await new Promise((resolve) => reservation.close(resolve))

function launch(command, args, env, { cwd = root, ipc = false } = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ipc ? ["inherit", "inherit", "inherit", "ipc"] : "inherit",
  })
  const done = new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
  const ready = ipc
    ? new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Local demonstration startup timed out")),
          90_000,
        )
        child.on("message", (message) => {
          if (message?.type === "ready") {
            clearTimeout(timer)
            resolve(message)
          }
        })
        done.then(() => {
          clearTimeout(timer)
          reject(new Error("Local demonstration exited before readiness"))
        }, reject)
      })
    : undefined
  // Teardown still owns children when readiness/build fails.
  ready?.catch(() => {})
  return { child, done, ready }
}
async function command(command, args, env, cwd) {
  const code = await launch(command, args, env, { cwd }).done
  if (code !== 0)
    throw new Error(`Local demonstration command failed (${code})`)
}
async function stop(owned) {
  if (!owned || owned.child.exitCode !== null) return
  if (owned.child.connected) owned.child.send({ type: "stop" })
  let timer
  const exited = await Promise.race([
    owned.done.then((code) => ({ code })),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), 25_000)
    }),
  ]).finally(() => clearTimeout(timer))
  if (!exited) {
    owned.child.kill()
    await owned.done
    throw new Error("Owned demo process required forced cleanup")
  }
  if (![0, 130, 143].includes(exited.code))
    throw new Error("Owned demo process did not exit cleanly")
}
let api, web, stopping
const shutdown = () =>
  (stopping ??= (async () => {
    try {
      await stop(web)
    } finally {
      await stop(api)
    }
  })())
process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
// An owning verifier can stop the ordinary demo command without HTTP controls.
process.on("message", (message) => {
  if (message?.type === "stop") void shutdown()
})
if (process.connected) process.once("disconnect", () => void shutdown())
try {
  console.log(
    "Starting a synthetic, ephemeral local demonstration. Existing databases and .env files are not used.",
  )
  await command(
    pnpm.command,
    [...pnpm.prefix, "--filter", "@nexus/api", "build"],
    offlineEnvironment({
      DIRECT_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
    }),
  )
  if (stopping) throw new Error("Local demonstration startup cancelled")
  api = launch(
    process.execPath,
    ["apps/api/dist/development/system-logs-demo.js"],
    offlineEnvironment({
      NODE_ENV: "development",
      PORT: "0",
      WEB_ORIGIN: webOrigin,
    }),
    { ipc: true },
  )
  const credentials = await api.ready
  const apiOrigin = loopbackOrigin(credentials.apiOrigin)
  if (stopping) throw new Error("Local demonstration startup cancelled")
  web = launch(
    process.execPath,
    ["scripts/system-logs-demo-web.mjs", String(port)],
    offlineEnvironment({
      NODE_ENV: "development",
      API_PROXY_TARGET: apiOrigin,
    }),
    { cwd: webRoot, ipc: true },
  )
  await web.ready
  console.log(
    `\nLocal demonstration: ${webOrigin}/internal/login\nSuperadmin: ${credentials.rootEmail}\nPassword for this run: ${credentials.password}\nSynthetic ADMIN/STAFF/USER: admin@demo.invalid, staff@demo.invalid, user@demo.invalid (same password).\nAll data disappears on exit. Production System Logs remains disabled. Ctrl+C stops both servers.\n`,
  )
  process.send?.({ type: "ready", webOrigin, ...credentials })
  if (verify) {
    const requireWeb = createRequire(path.join(webRoot, "package.json"))
    await command(
      process.execPath,
      [
        requireWeb.resolve("@playwright/test/cli"),
        "test",
        "--config=playwright.system-logs-demo.config.ts",
      ],
      offlineEnvironment({
        NODE_ENV: "test",
        CONVERYN_DEMO_ORIGIN: webOrigin,
        CONVERYN_DEMO_PASSWORD: credentials.password,
      }),
      webRoot,
    )
  } else {
    await Promise.race([api.done, web.done]).then((code) => {
      if (!stopping)
        throw new Error(`Local demonstration server exited (${code})`)
    })
  }
} finally {
  await shutdown()
  if (process.connected) process.disconnect()
}
