import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { restoreSession, configureRegressionTest } from "../regression-support"

configureRegressionTest()

test("[PG-017-F001-A001-T002] real booking reads isolate two clients and preserve persisted records", async ({
  page,
}) => {
  test.setTimeout(120000)
  const root = path.resolve(import.meta.dirname, "../../../..")
  let server: ChildProcess | undefined
  type Fixture = {
    origin: string
    control: string
    secret: string
    before: unknown
    a: { user: { id: string }; token: string }
    b: { user: { id: string }; token: string }
    own: { id: string; projectGoals: string }
    foreign: { id: string }
  }
  try {
    server = spawn(
      process.execPath,
      [
        path.join(root, "apps/api/scripts/run-tests.mjs"),
        "--fixture",
        "tests/support/pg017-browser-server.ts",
      ],
      {
        cwd: path.join(root, "apps/api"),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const fixture = await new Promise<Fixture>((resolve, reject) => {
      let output = "",
        errors = ""
      const timeout = setTimeout(
        () => reject(new Error("PG017 fixture startup timed out: " + errors)),
        90000,
      )
      server!.stderr?.on("data", (chunk) => {
        errors += String(chunk)
      })
      server!.stdout?.on("data", (chunk) => {
        output += String(chunk)
        const match = output.match(/PG017_READY:(\{[^\r\n]+\})/)
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
        reject(new Error("PG017 fixture exited " + code + ": " + errors))
      })
    })
    await restoreSession(page, "USER", { account: { id: fixture.a.user.id } })
    const reads: { path: string; status: number }[] = []
    await page.route("**/api/service-requests**", async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch({
        url: fixture.origin + url.pathname + url.search,
        headers: {
          ...route.request().headers(),
          authorization: "Bearer " + fixture.a.token,
        },
      })
      reads.push({ path: url.pathname, status: response.status() })
      await route.fulfill({ response })
    })
    await page.goto("/booked-services")
    const own = page.getByRole("button", {
      name: "View booking " + fixture.own.id,
      exact: true,
    })
    await expect(own).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: "View booking " + fixture.foreign.id,
        exact: true,
      }),
    ).toHaveCount(0)
    await own.click()
    const dialog = page.getByRole("dialog", {
      name: "Booking details",
      exact: true,
    })
    await expect(
      dialog.getByText(fixture.own.projectGoals, { exact: true }),
    ).toBeVisible()
    const foreign = await page.evaluate(async (id) => {
      const response = await fetch(
        "/api/service-requests/" + encodeURIComponent(id),
      )
      return { status: response.status, body: await response.json() }
    }, fixture.foreign.id)
    expect(foreign).toEqual({
      status: 404,
      body: { error: "Booked service not found" },
    })
    const clientB = await fetch(fixture.origin + "/api/service-requests", {
      headers: { authorization: "Bearer " + fixture.b.token },
    })
    expect(clientB.status).toBe(200)
    const body = (await clientB.json()) as {
      serviceRequests: { id: string }[]
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.serviceRequests.map(({ id }) => id)).toEqual([
      fixture.foreign.id,
    ])
    expect(reads).toEqual(
      expect.arrayContaining([
        { path: "/api/service-requests", status: 200 },
        { path: "/api/service-requests/" + fixture.own.id, status: 200 },
        { path: "/api/service-requests/" + fixture.foreign.id, status: 404 },
      ]),
    )
    const after = await fetch(fixture.control + "/snapshot", {
      headers: { "x-pg017-fixture": fixture.secret },
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
