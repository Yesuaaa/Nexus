import { test, expect } from "@playwright/test"

test.skip(
  !process.env.CONVERYN_DEMO_ORIGIN,
  "Use the owned local demonstration launcher",
)

// The launcher starts ordinary Next development + startApi, outside node:test.
// No route interception, session injection, fixture controls or test attestation.
for (const width of [390, 1600])
  test(`${width}px: normal local sign-in, three diagnostic views and server authorization`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const exceptions: string[] = []
    page.on("pageerror", (error) => exceptions.push(error.message))
    await page.goto("/internal/login")
    await page
      .getByLabel("Email address", { exact: true })
      .fill("superadmin@demo.invalid")
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.CONVERYN_DEMO_PASSWORD!)
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(page).toHaveURL(/\/module$/)
    await page.goto("/accounts")
    const activity = page.waitForResponse((response) =>
      response.url().includes("/api/system-logs/management-history?"),
    )
    await page.goto("/system-logs")
    expect((await activity).status()).toBe(200)
    await expect(page.getByLabel("Current audit module")).toContainText(
      "Administration",
    )
    const table = page.getByRole("table", { name: "Management audit events" })
    // Account provisioning also records its dependent Workforce changes.
    await expect(
      table.getByRole("button", { name: /^View event / }),
    ).toHaveCount(5)
    await table
      .getByRole("button", { name: /^View event / })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toContainText("Historical actor ID")
    await page.getByRole("button", { name: "Close event details" }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    const errors = page.waitForResponse((response) =>
      response.url().includes("/api/system-logs/errors"),
    )
    await page.getByRole("tab", { name: "Errors & Exceptions" }).click()
    expect((await errors).status()).toBe(200)
    await expect(
      page.getByRole("table", { name: "Application error records" }),
    ).toContainText("DATABASE_FAILURE")
    await page.getByRole("button", { name: "Details", exact: true }).click()
    await expect(page.getByRole("dialog")).toContainText("Correlation ID")
    await page.getByRole("button", { name: "Close error details" }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    const health = page.waitForResponse((response) =>
      response.url().endsWith("/api/system-logs/health"),
    )
    await page.getByRole("tab", { name: "System Health", exact: true }).click()
    const healthResponse = await health
    expect(healthResponse.status()).toBe(200)
    const snapshot = (await healthResponse.json()) as {
      database: { status: string }
      messageExpiry: { status: string }
      scope: string
    }
    expect(snapshot.database.status).toBe("Healthy")
    expect(snapshot.messageExpiry.status).toBe("Healthy")
    expect(snapshot.scope).toBe("instance")
    await expect(
      page.getByText("Instance-local observations only."),
    ).toBeVisible()
    const token = await page.evaluate(() =>
      sessionStorage.getItem("nexus.auth.token"),
    )
    expect(token).toBeTruthy()
    const headers = { Authorization: `Bearer ${token}` }
    const paths = ["management-history", "errors", "health"]
    for (const endpoint of paths) {
      const response = await page.request.get(`/api/system-logs/${endpoint}`, {
        headers,
      })
      expect(response.status()).toBe(200)
      expect(response.headers()["cache-control"]).toBe("no-store")
      expect(await response.text()).not.toMatch(
        /passwordHash|postgresql:|PrismaClient|SELECT|"stack"|"changes"/,
      )
      expect(
        (await page.request.get(`/api/system-logs/${endpoint}`)).status(),
      ).toBe(401)
    }
    const invalid = await page.request.get(
      "/api/system-logs/management-history?moduleId=private-sentinel",
      { headers },
    )
    expect(invalid.status()).toBe(400)
    expect(await invalid.text()).not.toContain("private-sentinel")
    for (const role of ["admin", "staff", "user"]) {
      const login = await page.request.post("/api/auth/login", {
        data: {
          email: `${role}@demo.invalid`,
          password: process.env.CONVERYN_DEMO_PASSWORD,
        },
      })
      expect(login.status()).toBe(200)
      const session = (await login.json()) as { token: string }
      for (const endpoint of paths)
        expect(
          (
            await page.request.get(`/api/system-logs/${endpoint}`, {
              headers: { Authorization: `Bearer ${session.token}` },
            })
          ).status(),
        ).toBe(403)
    }
    expect(
      (
        await page.request.post("/api/auth/sessions/revoke-all", { headers })
      ).status(),
    ).toBe(204)
    for (const endpoint of paths)
      expect(
        (
          await page.request.get(`/api/system-logs/${endpoint}`, { headers })
        ).status(),
      ).toBe(401)
    expect(exceptions).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
