import assert from "node:assert/strict"
import { test } from "node:test"
import { fork } from "node:child_process"
import { fileURLToPath } from "node:url"
import {
  createLocalDemoDatabase,
  verifyLocalDemo,
} from "../../../src/features/system-logs/local-demo.js"

test("demo ownership cannot be forged or minted in a native test worker", async () => {
  assert.equal(verifyLocalDemo(true), false)
  assert.equal(verifyLocalDemo({}), false)
  await assert.rejects(createLocalDemoDatabase(), /credential-isolated/)
})

test(
  "real development composition is owned, revocable and always closed in production",
  { timeout: 120_000 },
  async (t) => {
    const env = Object.fromEntries(
      ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE"]
        .filter((key) => process.env[key] !== undefined)
        .map((key) => [key, process.env[key]]),
    )
    const child = fork(
      fileURLToPath(
        new URL("../../support/system-logs-demo-probe.js", import.meta.url),
      ),
      [],
      {
        execArgv: [],
        windowsHide: true,
        env: {
          ...env,
          NODE_ENV: "development",
          WEB_ORIGIN: "http://127.0.0.1:5174",
          PORT: "0",
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    )
    t.after(() => {
      if (child.exitCode === null) child.kill()
    })
    let output = "",
      complete = false
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on("message", (message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "complete"
      )
        complete = true
    })
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", resolve)
    })
    assert.equal(code, 0, output)
    assert.equal(complete, true, output)
  },
)
