import assert from "node:assert/strict"
import { test } from "node:test"
import { spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { fileURLToPath } from "node:url"
import { offlineEnvironment } from "../scripts/offline-environment.mjs"

const launcher = fileURLToPath(
  new URL("../../../scripts/development/system-logs-demo.mjs", import.meta.url),
)
function run(args, environment = {}) {
  return spawnSync(process.execPath, [launcher, ...args], {
    windowsHide: true,
    encoding: "utf8",
    env: {
      ...offlineEnvironment({ NODE_ENV: "development", ...environment }),
      npm_execpath: process.env.npm_execpath ?? "pnpm.cjs",
    },
  })
}
test("demo launcher rejects production, external targets and malformed options before starting applications", () => {
  const production = run([], {
    NODE_ENV: "production",
    DATABASE_URL: "synthetic-secret",
  })
  assert.equal(production.status, 1)
  assert.match(production.stderr, /cannot run in production/)
  assert.ok(!production.stderr.includes("synthetic-secret"))
  for (const args of [
    ["--port", "0"],
    ["--port", "65536"],
    ["--port", "https://example.invalid"],
    ["--database-url", "untrusted"],
    ["--verify", "--verify"],
  ]) {
    const result = run(args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Usage:/)
    assert.ok(!result.stdout.includes("Starting a synthetic"))
  }
})
test("demo launcher refuses an occupied frontend port instead of reusing another application", async () => {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const result = run(["--port", String(server.address().port)])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /EADDRINUSE/)
    assert.ok(!result.stdout.includes("Starting a synthetic"))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
