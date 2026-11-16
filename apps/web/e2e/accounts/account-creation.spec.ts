import { expect, test } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

test.describe("Account creation", () => {
  test("[NEX-002] SUPERADMIN creates an account and sees validation and API errors", async ({
    page,
  }) => {
    const directoryUsers = [
      accountFor("SUPERADMIN"),
      accountFor("USER", {
        id: "user-target",
        email: "target@example.com",
        fullName: "Target User",
      }),
    ]
    await restoreSession(page, "SUPERADMIN", { initialUsers: directoryUsers })

    let createAttempts = 0
    await page.route("**/api/users*", async (route) => {
      const request = route.request()
      if (request.method() !== "POST") {
        await route.fallback()
        return
      }

      createAttempts += 1
      expect(request.headers().authorization).toBe("Bearer test-session")
      expect(request.postDataJSON()).toEqual({
        email: "nex002-user@example.com",
        fullName: "Nexus Regression User",
        contactNumber: "09123456789",
        password: "ValidPassword1!",
        role: "USER",
      })

      if (createAttempts === 1) {
        const created = accountFor("USER", {
          id: "nex002-user",
          email: "nex002-user@example.com",
          fullName: "Nexus Regression User",
          contactNumber: "09123456789",
        })
        directoryUsers.push(created)
        await route.fulfill({ status: 201, json: { user: created } })
        return
      }
      await route.fulfill({
        status: 503,
        json: { error: "Account creation is temporarily unavailable." },
      })
    })

    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(table.getByText("Target User", { exact: true })).toBeVisible()

    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    let dialog = page.getByRole("dialog", { name: "Create account" })
    await dialog.getByLabel("Email address").fill("nex002-user@example.com")
    await dialog.getByLabel("Full name").fill("Nexus Regression User")
    await dialog.getByLabel("Contact number").fill("09123456789")
    await dialog.getByLabel(/^Password/).fill("ValidPassword1!")
    await dialog.getByLabel(/^Confirm password/).fill("ValidPassword1!")
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()

    await expect(dialog).toHaveCount(0)
    await expect(
      table.getByText("Nexus Regression User", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("nex002-user@example.com", { exact: true }),
    ).toHaveCount(1)
    expect(createAttempts).toBe(1)

    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    dialog = page.getByRole("dialog", { name: "Create account" })
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await expect(dialog.getByText("Email address is required.")).toBeVisible()
    await expect(dialog.getByText("Password is required.")).toBeVisible()
    expect(createAttempts).toBe(1)

    await dialog.getByLabel("Email address").fill("nex002-user@example.com")
    await dialog.getByLabel("Full name").fill("Nexus Regression User")
    await dialog.getByLabel("Contact number").fill("09123456789")
    await dialog.getByLabel(/^Password/).fill("ValidPassword1!")
    await dialog.getByLabel(/^Confirm password/).fill("ValidPassword1!")
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()

    await expect(dialog.getByRole("alert")).toHaveText(
      "Account creation is temporarily unavailable.",
    )
    await expect(
      table.getByText("nex002-user@example.com", { exact: true }),
    ).toHaveCount(1)
    expect(createAttempts).toBe(2)
  })
})
