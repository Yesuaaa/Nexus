import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import {
  hasPermission,
  Permission,
  permissionsFor,
} from "../../../src/features/auth/auth.permissions.js"

test("clients:create is explicit and belongs only to the existing management creators", () => {
  assert.equal(Permission.CLIENTS_CREATE, "clients:create")
  for (const role of Object.values(Role)) {
    const creator = role === "ADMIN" || role === "SUPERADMIN"
    assert.equal(hasPermission(role, Permission.CLIENTS_CREATE), creator)
    assert.equal(
      permissionsFor(role).includes(Permission.CLIENTS_CREATE),
      creator,
    )
    assert.equal(hasPermission(role, Permission.CLIENTS_READ), creator)
  }
})

test(
  "real Client endpoints deny a read-only permission configuration",
  { timeout: 120_000 },
  async () => {
    // Module mocks require Node's explicit flag. Keep the altered catalog isolated
    // in a child test process, with no production configuration hook or role edit.
    const fixture = fileURLToPath(
      new URL("../../support/client-create-readonly.js", import.meta.url),
    )
    const childEnv = { ...process.env }
    // An inherited test-worker marker makes Node skip a nested --test invocation.
    delete childEnv.NODE_TEST_CONTEXT
    let output = ""
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--test",
          "--test-reporter=tap",
          fixture,
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: childEnv,
          windowsHide: true,
        },
      )
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString()
      })
      child.stderr.on("data", (data: Buffer) => {
        output += data.toString()
      })
      child.once("error", reject)
      child.once("exit", resolve)
    })
    assert.equal(code, 0, output)
    assert.match(output, /# pass 1\b/, output)
  },
)
