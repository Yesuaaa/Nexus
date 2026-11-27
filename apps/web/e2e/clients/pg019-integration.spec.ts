import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { restoreSession, configureRegressionTest } from "../regression-support"

configureRegressionTest()

test("[PG-019-F001-A023-T001] real Client form and parent inspection preserve authorization and persisted history", async ({
  page,
}) => {
  test.setTimeout(120000)
  const root = path.resolve(import.meta.dirname, "../../../..")
  let server: ChildProcess | undefined
  type Snapshot = {
    users: { id: string; email: string; role: string; passwordHash: string }[]
    history: {
      actorAccountId: string
      subjectAccountId: string
      action: string
    }[]
  }
  type Actor = { user: { id: string; fullName: string }; token: string }
  type Fixture = {
    origin: string
    control: string
    secret: string
    before: Snapshot
    admin: Actor
    root: Actor
    head: Actor
    a: Actor
    b: Actor
  }
  try {
    server = spawn(
      process.execPath,
      [
        path.join(root, "apps/api/scripts/run-tests.mjs"),
        "--fixture",
        "tests/support/pg019-browser-server.ts",
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
        () => reject(new Error("PG019 fixture startup timed out: " + errors)),
        90000,
      )
      server!.stderr?.on("data", (chunk) => {
        errors += String(chunk)
      })
      server!.stdout?.on("data", (chunk) => {
        output += String(chunk)
        const match = output.match(/PG019_READY:(\{[^\r\n]+\})/)
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
        reject(new Error("PG019 fixture exited " + code + ": " + errors))
      })
    })
    const snapshot = async () => {
      const response = await fetch(fixture.control + "/snapshot", {
        headers: { "x-pg019-fixture": fixture.secret },
      })
      expect(response.status).toBe(200)
      return (await response.json()) as Snapshot
    }
    await restoreSession(page, "ADMIN", {
      account: { id: fixture.admin.user.id },
    })
    const reads: string[] = []
    await page.route("**/api/clients**", async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch({
        url: fixture.origin + url.pathname + url.search,
        headers: {
          ...route.request().headers(),
          authorization: "Bearer " + fixture.admin.token,
        },
      })
      reads.push(route.request().method() + " " + url.pathname)
      await route.fulfill({ response })
    })
    await page.goto("/clients")
    await page
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    const form = page.getByRole("dialog")
    await form.getByLabel("Full Name").fill("Persisted Client")
    await form.getByLabel("Email Address").fill("persisted@pg019.test")
    await form.getByLabel("Contact Number").fill("09123456789")
    await form.getByLabel("Initial Password").fill("SyntheticClient123!")
    await form
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    await expect(form).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "View Persisted Client", exact: true }),
    ).toBeVisible()
    const afterCreate = await snapshot()
    expect(afterCreate.users).toHaveLength(fixture.before.users.length + 1)
    expect(afterCreate.history).toHaveLength(fixture.before.history.length + 1)
    const created = afterCreate.users.find(
      (u) => u.email === "persisted@pg019.test",
    )!
    expect(created.role).toBe("USER")
    expect(created.passwordHash).toMatch(/^scrypt\$/)
    expect(
      afterCreate.history.find((h) => h.subjectAccountId === created.id),
    ).toMatchObject({
      actorAccountId: fixture.admin.user.id,
      action: "CREATED",
    })
    await page
      .getByRole("button", { name: "View Persisted Client", exact: true })
      .click()
    await expect(
      page
        .getByRole("dialog")
        .getByRole("region", { name: "Personal information" }),
    ).toContainText("persisted@pg019.test")
    await page.getByRole("button", { name: "Close client details" }).click()
    for (const [actor, label, other] of [
      [fixture.a, "A", "B"],
      [fixture.b, "B", "A"],
    ] as const) {
      await page
        .getByRole("button", {
          name: "View " + actor.user.fullName,
          exact: true,
        })
        .click()
      const panel = page.getByRole("dialog")
      await panel
        .getByRole("tab", { name: "Service requests", exact: true })
        .click()
      await expect(
        panel.getByRole("cell", { name: "Request " + label, exact: true }),
      ).toBeVisible()
      await expect(
        panel.getByText("Request " + other, { exact: true }),
      ).toHaveCount(0)
      await panel.getByRole("tab", { name: "Projects", exact: true }).click()
      await expect(
        panel.getByRole("cell", { name: "Project " + label, exact: true }),
      ).toBeVisible()
      await expect(
        panel.getByText("Project " + other, { exact: true }),
      ).toHaveCount(0)
      await panel.getByRole("button", { name: "Close client details" }).click()
    }
    for (const actor of [fixture.a, fixture.head]) {
      for (const method of ["GET", "POST"]) {
        const response = await fetch(fixture.origin + "/api/clients", {
          method,
          headers: {
            authorization: "Bearer " + actor.token,
            "content-type": "application/json",
          },
          ...(method === "POST"
            ? {
                body: JSON.stringify({
                  fullName: "Denied client",
                  email: "denied@pg019.test",
                  contactNumber: "09123456789",
                  isActive: true,
                  password: "SyntheticClient123!",
                  role: "SUPERADMIN",
                }),
              }
            : {}),
        })
        expect(response.status).toBe(403)
      }
    }
    const rootRead = await fetch(
      fixture.origin + "/api/clients/" + fixture.a.user.id,
      { headers: { authorization: "Bearer " + fixture.root.token } },
    )
    expect(rootRead.status).toBe(200)
    const profile = (await rootRead.json()) as {
      client: object
      projectCount: number
      serviceRequestCount: number
    }
    expect(Object.keys(profile.client).sort()).toEqual(
      [
        "id",
        "fullName",
        "email",
        "contactNumber",
        "isActive",
        "createdAt",
      ].sort(),
    )
    expect(profile.projectCount).toBe(1)
    expect(profile.serviceRequestCount).toBe(1)
    expect(reads.filter((r) => r.startsWith("POST"))).toEqual([
      "POST /api/clients",
    ])
    expect(reads.some((r) => /PATCH|DELETE/.test(r))).toBe(false)
    expect(await snapshot()).toEqual(afterCreate)
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
