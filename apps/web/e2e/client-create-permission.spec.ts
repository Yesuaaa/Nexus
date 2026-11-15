import { expect, test } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Client permission separation uses isolated API contracts")

for (const role of ["ADMIN", "SUPERADMIN"] as const) {
  test(`${role} with Client read only retains inspection and has no Create control`, async ({
    page,
  }) => {
    await restoreSession(page, role, {
      account: {
        permissions: accountFor(role).permissions.filter(
          (permission) => permission !== "clients:create",
        ),
      },
    })
    const writes: string[] = []
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/clients") &&
        request.method() !== "GET"
      )
        writes.push(request.url())
    })
    await page.goto("/clients")
    await expect(
      page.getByRole("heading", { name: "Client Management", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Create Client", exact: true }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: /View.*Target User/i }).click()
    const details = page.getByRole("dialog")
    await expect(details).toContainText("target@example.com")
    await expect(details.getByLabel("Initial Password")).toHaveCount(0)
    await page.getByRole("button", { name: "Close client details" }).click()
    expect(writes).toEqual([])
  })

  test(`${role} with Client create can open the existing form`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    await page.goto("/clients")
    await page
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    await expect(
      page.getByRole("dialog").getByLabel("Initial Password"),
    ).toBeVisible()
  })

  test(`${role} retains form input when the backend rejects creation`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    let attempts = 0
    await page.route("**/api/clients", async (route) => {
      if (route.request().method() !== "POST") return route.fallback()
      attempts++
      return route.fulfill({
        status: 403,
        json: { error: "Insufficient permissions" },
      })
    })
    await page.goto("/clients")
    await page
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Full Name").fill("Permission Test")
    await dialog.getByLabel("Email Address").fill("permission@example.test")
    await dialog.getByLabel("Contact Number").fill("09123456789")
    await dialog.getByLabel("Initial Password").fill("ValidClientPassword123!")
    await dialog
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    await expect(dialog.getByRole("alert")).toContainText(
      "Insufficient permissions",
    )
    await expect(dialog.getByLabel("Email Address")).toHaveValue(
      "permission@example.test",
    )
    expect(attempts).toBe(1)
  })
}
