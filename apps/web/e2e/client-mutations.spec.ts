import { expect, test } from "@playwright/test"
import type { Client } from "../src/features/clients/api/clients-api"

for (const width of [1440, 390]) {
  test(`client creation, editing and deletion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    let clients: Client[] = []
    let rejectSave = true
    let rejectDelete = true
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
      if (path === "/api/clients/client-new" && request.method() === "PATCH") {
        const input = request.postDataJSON()
        expect(input).not.toHaveProperty("password")
        clients = [{ ...clients[0], ...input }]
        return route.fulfill({ json: { client: clients[0] } })
      }
      if (path === "/api/clients/client-new" && request.method() === "DELETE") {
        if (rejectDelete) {
          rejectDelete = false
          return route.fulfill({
            status: 409,
            json: {
              error:
                "This client has service requests or projects and cannot be deleted.",
            },
          })
        }
        clients = []
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ status: 404, json: { error: "Not found" } })
    })
    await page.goto("/clients")
    await page
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    let dialog = page.getByRole("dialog")
    await dialog.getByLabel("Full Name").fill("Test Client")
    await dialog.getByLabel("Email Address").fill("test@example.com")
    await dialog.getByLabel("Contact Number").fill("09171234567")
    await dialog.getByLabel("Initial Password").fill("initial client password")
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog.getByRole("alert")).toContainText("already exists")
    await expect(dialog.getByLabel("Full Name")).toHaveValue("Test Client")
    await dialog.getByLabel("Email Address").fill("new@example.com")
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog).toHaveCount(0)
    await page
      .getByRole("button", { name: "Edit Test Client", exact: true })
      .click()
    dialog = page.getByRole("dialog")
    await expect(dialog.getByLabel("Email Address")).toHaveValue(
      "new@example.com",
    )
    await expect(dialog.getByLabel("Initial Password")).toHaveCount(0)
    await dialog.getByLabel("Full Name").fill("Updated Client")
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    await expect(dialog).toHaveCount(0)
    await page
      .getByRole("button", { name: "Delete Updated Client", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click()
    await expect(
      page.getByRole("button", { name: "Delete Updated Client", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Delete Updated Client", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete Client", exact: true })
      .click()
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "cannot be deleted",
    )
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete Client", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText("No clients registered yet.")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}
