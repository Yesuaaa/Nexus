import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { restoreSession, configureRegressionTest } from "../regression-support"

configureRegressionTest()

test("[PG-018-F001-A019-T003] real calendar reads isolate two clients and preserve persisted records", async ({
  page,
}) => {
  test.setTimeout(120000)
  const root = path.resolve(import.meta.dirname, "../../../..")
  let server: ChildProcess | undefined
  type Records = {
    booking: { id: string; clientId: string }
    consultation: { id: string }
    conversation: { id: string }
    meeting: { id: string }
    project: {
      id: string
      milestones: { id: string; sentToClientAt: string | null }[]
    }
  }
  type Fixture = {
    origin: string
    control: string
    secret: string
    before: unknown
    a: { user: { id: string }; token: string }
    b: { user: { id: string }; token: string }
    own: Records
    foreign: Records
  }
  try {
    server = spawn(
      process.execPath,
      [
        path.join(root, "apps/api/scripts/run-tests.mjs"),
        "--fixture",
        "tests/support/pg018-browser-server.ts",
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
        () => reject(new Error("PG018 fixture startup timed out: " + errors)),
        90000,
      )
      server!.stderr?.on("data", (chunk) => {
        errors += String(chunk)
      })
      server!.stdout?.on("data", (chunk) => {
        output += String(chunk)
        const match = output.match(/PG018_READY:(\{[^\r\n]+\})/)
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
        reject(new Error("PG018 fixture exited " + code + ": " + errors))
      })
    })
    await page.clock.install({ time: new Date("2030-02-03T02:00:00Z") })
    await restoreSession(page, "USER", { account: { id: fixture.a.user.id } })
    const reads: string[] = []
    await page.route("**/api/projects/calendar**", async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch({
        url: fixture.origin + url.pathname + url.search,
        headers: {
          ...route.request().headers(),
          authorization: "Bearer " + fixture.a.token,
        },
      })
      expect(response.status()).toBe(200)
      reads.push(route.request().method() + " " + url.pathname)
      await route.fulfill({ response })
    })
    await page.goto("/calendar")
    const day = page.getByRole("region", { name: "Sunday, February 3" })
    await expect(
      day.getByText("Shared milestone A", { exact: true }),
    ).toBeVisible()
    await expect(
      day.getByText("Shared milestone B", { exact: true }),
    ).toHaveCount(0)
    await expect(
      day.getByRole("link", { name: "View Shared milestone A" }),
    ).toHaveAttribute("href", "/projects/" + fixture.own.project.id)
    await expect(
      day.getByRole("link", { name: "View Calendar service consultation" }),
    ).toHaveAttribute(
      "href",
      "/messages?request=" + encodeURIComponent(fixture.own.booking.id),
    )
    await expect(
      day.getByRole("link", { name: "View Service meeting" }),
    ).toHaveAttribute(
      "href",
      "/messages?request=" + encodeURIComponent(fixture.own.conversation.id),
    )
    for (const [actor, own, excluded] of [
      [fixture.a, fixture.own, fixture.foreign],
      [fixture.b, fixture.foreign, fixture.own],
    ] as const) {
      const result = await fetch(
        fixture.origin +
          "/api/projects/calendar?scope=team&clientId=" +
          excluded.booking.clientId,
        { headers: { authorization: "Bearer " + actor.token } },
      )
      expect(result.status).toBe(200)
      const events = (await result.json()) as { id: string; type: string }[]
      expect(events.map((event) => event.id).sort()).toEqual(
        [
          "consultation-" + own.consultation.id,
          "meeting-" + own.meeting.id,
          "milestone-" +
            own.project.milestones.find((m) => m.sentToClientAt)!.id,
        ].sort(),
      )
      expect(
        events.some((event) => event.type === "task" || event.type === "leave"),
      ).toBe(false)
    }
    expect(reads).toEqual(["GET /api/projects/calendar"])
    const after = await fetch(fixture.control + "/snapshot", {
      headers: { "x-pg018-fixture": fixture.secret },
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
