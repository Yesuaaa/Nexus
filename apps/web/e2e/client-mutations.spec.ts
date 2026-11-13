import { expect, test } from "@playwright/test"
import type { Client } from "../src/features/clients/api/clients-api"

for (const width of [1440, 390]) {
  test(`client creation validates, retries conflicts and opens read-only details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    let clients: Client[] = []
    let rejectSave = true
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "test-session"),
    )
    await page.route("**/api/**", async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === "/api/auth/me")
        return route.fulfill({
          json: {
            user: {
              id: "admin",
              fullName: "Admin",
              email: "admin@example.com",
              role: "ADMIN",
              isActive: true,
              permissions: ["clients:read", "dashboard:read"],
              createdAt: "2026-10-01T00:00:00Z",
            },
          },
        })
      if (path === "/api/clients" && request.method() === "GET")
        return route.fulfill({
          json: { clients, total: clients.length, page: 1, pageSize: 10 },
        })
      if (path === "/api/clients" && request.method() === "POST") {
        if (rejectSave) {
          rejectSave = false
          return route.fulfill({
            status: 409,
            json: { error: "An account with this email already exists." },
          })
        }
        const input = request.postDataJSON()
        const client = {
          id: "client-new",
          fullName: input.fullName,
          email: input.email,
          contactNumber: input.contactNumber,
          isActive: input.isActive,
          createdAt: "2026-10-30T00:00:00Z",
        }
        clients = [client]
        return route.fulfill({ status: 201, json: { client } })
      }
      if (path === "/api/clients/client-new" && request.method() === "GET")
        return route.fulfill({
          json: { client: clients[0], serviceRequestCount: 0, projectCount: 0 },
        })
      expect(["PATCH", "DELETE"]).not.toContain(request.method())
      return route.fulfill({ status: 404, json: { error: "Not found" } })
    })
    await page.goto("/clients")
    await page
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    let dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog.getByLabel("Full Name")).toBeFocused()
    await expect(dialog.locator("[data-field-error]")).toHaveCount(4)
    expect(rejectSave).toBe(true)
    await dialog.getByLabel("Full Name").fill("Test Client")
    await dialog.getByLabel("Email Address").fill("invalid-email")
    await dialog.getByLabel("Contact Number").fill("09171234567")
    await dialog
      .getByLabel("Initial Password")
      .fill("Initial client password1!")
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog.getByLabel("Email Address")).toBeFocused()
    await expect(
      dialog.getByLabel("Email Address"),
    ).toHaveAccessibleDescription("Enter a valid email address.")
    await expect(dialog.locator("[data-field-error]")).toHaveCount(1)
    expect(rejectSave).toBe(true)
    await page.screenshot({
      path: `test-results/client-validation-${width}.png`,
    })
    await dialog.getByLabel("Email Address").fill("test@example.com")
    await expect(dialog.locator("[data-field-error]")).toHaveCount(0)
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog.getByRole("alert")).toContainText("already exists")
    await expect(dialog.getByLabel("Full Name")).toHaveValue("Test Client")
    await dialog.getByLabel("Email Address").fill("new@example.com")
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog).toHaveCount(0)
    const view = page.getByRole("button", {
      name: "View Test Client",
      exact: true,
    })
    await view.click()
    dialog = page.getByRole("dialog")
    await expect(
      dialog.getByText("new@example.com", { exact: true }),
    ).toBeVisible()
    await expect(dialog.getByText("09171234567", { exact: true })).toBeVisible()
    await expect(dialog.getByLabel("Initial Password")).toHaveCount(0)
    await dialog.getByRole("button", { name: "Close client details" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(view).toBeFocused()
    await expect(
      page.getByRole("button", { name: "Edit Test Client", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: "More actions for Test Client",
        exact: true,
      }),
    ).toHaveCount(0)
    expect(clients).toHaveLength(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}
