import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import {
  configureRegressionTest,
  restoreSession,
  live,
} from "../regression-support"

configureRegressionTest()
test.skip(live, "PG-016 requires isolated billing persistence")

test("[PG-016-F001-A011-T002] real client billing and protected files remain isolated across clients", async ({
  page,
}) => {
  test.setTimeout(120000)
  const root = path.resolve(import.meta.dirname, "../../../..")
  let server: ChildProcess | undefined
  try {
    server = spawn(
      process.execPath,
      [
        path.join(root, "apps/api/scripts/run-tests.mjs"),
        "--fixture",
        "tests/support/pg016-browser-server.ts",
      ],
      {
        cwd: path.join(root, "apps/api"),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    type Fixture = {
      origin: string
      control: string
      secret: string
      before: unknown
      a: { user: { id: string }; token: string }
      b: { user: { id: string }; token: string }
      own: {
        request: { id: string }
        file: { id: string; name: string }
        payment: { id: string }
      }
      foreign: {
        request: { id: string }
        file: { id: string; name: string }
        payment: { id: string }
      }
    }
    const fixture = await new Promise<Fixture>((resolve, reject) => {
      let output = "",
        errors = ""
      const timeout = setTimeout(
        () => reject(new Error("PG-016 fixture startup timed out: " + errors)),
        90000,
      )
      server!.stderr?.on("data", (data) => {
        errors += String(data)
      })
      server!.stdout?.on("data", (data) => {
        output += String(data)
        const match = output.match(/PG016_READY:(\{[^\r\n]+\})/)
        if (match) {
          clearTimeout(timeout)
          resolve(JSON.parse(match[1]) as Fixture)
        }
      })
      server!.once("error", (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      server!.once("exit", (code) => {
        clearTimeout(timeout)
        reject(new Error("PG-016 fixture exited " + code + ": " + errors))
      })
    })
    const actualReads: { url: string; status: number }[] = []
    await restoreSession(page, "USER", { account: { id: fixture.a.user.id } })
    await page.route("**/api/request-workflows/**", async (route) => {
      const url = new URL(route.request().url())
      if (
        url.pathname !== "/api/request-workflows/billing" &&
        !/\/files\//.test(url.pathname)
      ) {
        await route.fallback()
        return
      }
      const response = await route.fetch({
        url: fixture.origin + url.pathname + url.search,
        headers: {
          ...route.request().headers(),
          authorization: "Bearer " + fixture.a.token,
        },
      })
      actualReads.push({ url: url.pathname, status: response.status() })
      await route.fulfill({ response })
    })
    await page.goto("/billing-logs")
    await expect(page.getByText("PG016-own", { exact: true })).toBeVisible()
    await expect(page.getByText("PG016-foreign", { exact: true })).toHaveCount(
      0,
    )
    await expect(page.getByText("₱125.07", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "View proof", exact: true }).click()
    const dialog = page.getByRole("dialog", {
      name: "Payment proof",
      exact: true,
    })
    await expect(
      dialog.getByText(fixture.own.file.name, { exact: true }),
    ).toBeVisible()
    const downloaded = page.waitForEvent("download")
    await dialog
      .getByRole("button", { name: "Download proof", exact: true })
      .click()
    const download = await downloaded
    expect(download.suggestedFilename()).toBe(fixture.own.file.name)
    const bytes: Buffer[] = []
    for await (const chunk of await download.createReadStream())
      bytes.push(Buffer.from(chunk))
    expect(Buffer.concat(bytes).toString("utf8")).toBe(
      "PG-016 synthetic protected receipt. No financial transaction.",
    )
    const denied = await page.evaluate(
      async ({ request, file }) => {
        const response = await fetch(
          "/api/request-workflows/" + request + "/files/" + file,
        )
        return { status: response.status, body: await response.json() }
      },
      { request: fixture.foreign.request.id, file: fixture.foreign.file.id },
    )
    expect(denied).toEqual({
      status: 404,
      body: { error: "Workflow not found" },
    })
    const clientB = await fetch(
      fixture.origin + "/api/request-workflows/billing",
      { headers: { authorization: "Bearer " + fixture.b.token } },
    )
    expect(clientB.status).toBe(200)
    expect(
      ((await clientB.json()) as { id: string }[]).map(({ id }) => id),
    ).toEqual([fixture.foreign.payment.id])
    expect(actualReads).toEqual([
      { url: "/api/request-workflows/billing", status: 200 },
      {
        url:
          "/api/request-workflows/" +
          fixture.own.request.id +
          "/files/" +
          fixture.own.file.id,
        status: 200,
      },
      {
        url:
          "/api/request-workflows/" +
          fixture.foreign.request.id +
          "/files/" +
          fixture.foreign.file.id,
        status: 404,
      },
    ])
    const after = await fetch(fixture.control + "/snapshot", {
      headers: { "x-pg016-fixture": fixture.secret },
    })
    expect(after.status).toBe(200)
    expect(await after.json()).toEqual(fixture.before)
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" })
    if (server && server.exitCode === null) {
      const stopped = new Promise<void>((resolve) =>
        server!.once("exit", () => resolve()),
      )
      server.kill("SIGTERM")
      await stopped
    }
  }
})
