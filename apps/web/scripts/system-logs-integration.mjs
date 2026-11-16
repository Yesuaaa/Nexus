import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFile, mkdtemp, mkdir, unlink } from "node:fs/promises"
import { createServer } from "node:net"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"
import {
  offlineEnvironment,
  pnpmInvocation,
  loopbackOrigin,
} from "./offline-environment.mjs"

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
)
const web = path.join(root, "apps/web")
const requireWeb = createRequire(path.join(web, "package.json"))
const pnpm = pnpmInvocation()

function launch(command, args, env, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env,
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: "inherit",
  })
  const done = new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
  return { child, done }
}
async function command(command, args, env, cwd = root) {
  assert.equal(
    await launch(command, args, env, cwd).done,
    0,
    `Offline command failed: ${path.basename(command)} ${args.join(" ")}`,
  )
}
async function within(promise, milliseconds) {
  const timer = new AbortController()
  try {
    return await Promise.race([
      promise,
      delay(milliseconds, null, { signal: timer.signal }),
    ])
  } finally {
    timer.abort()
  }
}
async function terminate(owned) {
  if (owned.child.exitCode !== null) return
  if (process.platform === "win32") {
    // The standalone server runs in this directly owned Node process. Avoid
    // shell process-tree commands, which may be denied in restricted runners.
    assert.ok(owned.child.kill(), "Could not stop owned offline process")
  } else process.kill(-owned.child.pid, "SIGTERM")
  assert.notEqual(
    await within(owned.done, 10_000),
    null,
    "Owned offline process did not exit",
  )
}
if (!process.argv.includes("--quality-only")) {
  await mkdir(path.join(root, ".ci-tools"), { recursive: true })
  const run = await mkdtemp(path.join(root, ".ci-tools/system-logs-offline-"))
  const manifestPath = path.join(run, "fixture.json")
  const reservation = createServer()
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve))
  const address = reservation.address()
  assert.ok(address && typeof address !== "string")
  const webOrigin = `http://127.0.0.1:${address.port}`
  await new Promise((resolve) => reservation.close(resolve))

  let manifest
  let server
  const fixture = launch(
    process.execPath,
    [
      "apps/api/scripts/run-tests.mjs",
      "tests/support/system-logs-browser-server.ts",
    ],
    offlineEnvironment({
      NODE_ENV: "test",
      WEB_ORIGIN: webOrigin,
      SYSTEM_LOGS_OFFLINE_MANIFEST: manifestPath,
    }),
  )
  try {
    for (let attempt = 0; attempt < 600; attempt++) {
      if (fixture.child.exitCode !== null)
        throw new Error("Native offline fixture exited before readiness")
      try {
        manifest = JSON.parse(await readFile(manifestPath, "utf8"))
        break
      } catch (error) {
        if (error.code !== "ENOENT" && !(error instanceof SyntaxError))
          throw error
      }
      await delay(100)
    }
    assert.ok(
      manifest?.nativeWorker,
      "Native offline fixture did not attest readiness",
    )
    assert.equal(loopbackOrigin(manifest.webOrigin), webOrigin)
    loopbackOrigin(manifest.apiOrigin)
    loopbackOrigin(manifest.controlOrigin)
    loopbackOrigin(manifest.closedOrigin)
    const buildEnv = offlineEnvironment({
      NODE_ENV: "production",
      API_PROXY_TARGET: manifest.apiOrigin,
      DIRECT_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
    })
    await command(pnpm.command, [...pnpm.prefix, "build"], buildEnv)
    const routes = JSON.parse(
      await readFile(path.join(web, ".next/routes-manifest.json"), "utf8"),
    )
    const rewrites = Array.isArray(routes.rewrites)
      ? routes.rewrites
      : routes.rewrites.afterFiles
    assert.ok(
      rewrites.some(
        (rule) =>
          rule.source === "/api/:path*" &&
          rule.destination === `${manifest.apiOrigin}/api/:path*`,
      ),
    )
    server = launch(
      process.execPath,
      ["scripts/start.mjs"],
      offlineEnvironment({
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: String(address.port),
      }),
      web,
    )
    let ready = false
    for (let attempt = 0; attempt < 300; attempt++) {
      if (server.child.exitCode !== null)
        throw new Error("Controlled standalone web server exited")
      try {
        const response = await fetch(webOrigin, {
          headers: { connection: "close" },
          signal: AbortSignal.timeout(1500),
        })
        await response.body?.cancel()
        if (response.ok) {
          ready = true
          break
        }
      } catch {
        /* Startup only. */
      }
      await delay(100)
    }
    assert.ok(ready, "Controlled standalone web server did not start")
    const env = offlineEnvironment({
      NODE_ENV: "test",
      SYSTEM_LOGS_OFFLINE_MANIFEST: manifestPath,
      SYSTEM_LOGS_OFFLINE_OUTPUT: run,
    })
    for (const project of [
      "express-forwarded",
      "next-rewrite",
      "frontend-fixtures",
    ])
      await command(
        process.execPath,
        [
          requireWeb.resolve("@playwright/test/cli"),
          "test",
          "--config=playwright.system-logs.config.ts",
          `--project=${project}`,
          `--output=${path.join(run, "browser", project)}`,
        ],
        env,
        web,
      )
    const result = await fetch(`${manifest.controlOrigin}/stats`, {
      method: "POST",
      headers: { "x-offline-control": manifest.secret, connection: "close" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    })
    const stats = await result.json()
    assert.equal(stats.historiesUnchanged, true)
    assert.ok(
      stats.observed["express-forwarded"] > 0 &&
        stats.observed["next-rewrite"] > 0,
    )
    console.log(
      "Real Express/PGlite, standalone Next rewrite and separate mocked UI projects passed; history unchanged.",
    )
  } finally {
    try {
      try {
        if (server) await terminate(server)
      } finally {
        if (manifest)
          await fetch(`${manifest.controlOrigin}/stop`, {
            method: "POST",
            headers: {
              "x-offline-control": manifest.secret,
              connection: "close",
            },
            body: "{}",
            signal: AbortSignal.timeout(5000),
          })
            .then((response) => response.body?.cancel())
            .catch(() => {})
        const exited = await within(
          fixture.done.then((code) => ({ code })),
          20_000,
        )
        if (!exited) await terminate(fixture)
        assert.ok(exited, "Native offline fixture required forced cleanup")
        assert.equal(exited.code, 0, "Native offline fixture cleanup failed")
      }
    } finally {
      await unlink(manifestPath).catch((error) => {
        if (error.code !== "ENOENT") throw error
      })
    }
  }
  console.log(`Offline integration artifacts: ${run}`)
}
if (
  process.argv.includes("--quality") ||
  process.argv.includes("--quality-only")
) {
  const env = offlineEnvironment({
    DIRECT_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
  })
  for (const check of ["format", "lint", "typecheck"])
    await command(pnpm.command, [...pnpm.prefix, check], env)
  await command(
    process.execPath,
    ["apps/api/scripts/run-tests.mjs"],
    offlineEnvironment({ NODE_ENV: "test" }),
  )
  await command(
    pnpm.command,
    [...pnpm.prefix, "--filter", "@nexus/web", "test"],
    offlineEnvironment({ NODE_ENV: "test" }),
  )
}
