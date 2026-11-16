import { expect, test } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

test.describe("Account management regression coverage", () => {
  test("[NEX-019] role filtering, member sorting, and pagination reach the account list API", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const users = Array.from({ length: 12 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0")
      const role = index % 3 === 0 ? "STAFF" : "USER"
      return accountFor(role, {
        id: `directory-${number}`,
        email: `member-${number}@example.com`,
        fullName: `Regression Member ${number}`,
        createdAt: `2026-01-${number}T00:00:00.000Z`,
      })
    })
    const requests: URL[] = []

    await restoreSession(page, "SUPERADMIN", { initialUsers: users })
    await page.route("**/api/users?**", async (route) => {
      const request = route.request()
      if (request.method() !== "GET") {
        await route.fallback()
        return
      }

      const url = new URL(request.url())
      requests.push(url)
      const role = url.searchParams.get("role")
      const sort = url.searchParams.get("sort")
      const direction = url.searchParams.get("direction") ?? "desc"
      const pageNumber = Number(url.searchParams.get("page") ?? "1")
      const matching = users
        .filter((user) => !role || user.role === role)
        .sort((left, right) => {
          if (sort !== "member") return 0
          const comparison = left.fullName!.localeCompare(right.fullName!)
          return direction === "asc" ? comparison : -comparison
        })

      await route.fulfill({
        json: {
          users: matching.slice((pageNumber - 1) * 10, pageNumber * 10),
          total: matching.length,
          page: pageNumber,
          pageSize: 10,
        },
      })
    })

    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(
      table.getByText("Regression Member 01", { exact: true }),
    ).toBeVisible()
    await expect.poll(() => requests.length).toBeGreaterThan(0)

    await page
      .getByRole("combobox", { name: "Filter by role: All roles" })
      .click()
    await page.getByRole("option", { name: "Staff", exact: true }).click()
    await expect(
      table.getByText("Regression Member 04", { exact: true }).first(),
    ).toBeVisible()
    await expect(
      table.getByText("Regression Member 02", { exact: true }),
    ).toHaveCount(0)
    await expect
      .poll(() =>
        requests.some(
          (url) =>
            url.searchParams.get("role") === "STAFF" &&
            url.searchParams.get("page") === "1",
        ),
      )
      .toBe(true)

    await page.getByRole("combobox", { name: "Filter by role: Staff" }).click()
    await page.getByRole("option", { name: "All roles", exact: true }).click()
    await page.getByRole("button", { name: "Sort by Member" }).click()
    await expect
      .poll(() =>
        requests.some(
          (url) =>
            url.searchParams.get("sort") === "member" &&
            url.searchParams.get("direction") === "asc" &&
            url.searchParams.get("page") === "1",
        ),
      )
      .toBe(true)

    const nextPage = page.getByRole("button", { name: "Next page" })
    await expect(nextPage).toBeEnabled()
    await nextPage.click()
    await expect(
      table.getByText("Regression Member 11", { exact: true }),
    ).toBeVisible()
    await expect
      .poll(() =>
        requests.some(
          (url) =>
            url.searchParams.get("sort") === "member" &&
            url.searchParams.get("direction") === "asc" &&
            url.searchParams.get("page") === "2",
        ),
      )
      .toBe(true)
  })

  test("[NEX-020] account list failures show a retry and recover without stale rows", async ({
    page,
  }) => {
    const previousAccount = accountFor("USER", {
      id: "previous-account",
      email: "previous@example.com",
      fullName: "Previous Account",
    })
    const recoveredAccount = accountFor("USER", {
      id: "recovered-account",
      email: "recovered@example.com",
      fullName: "Recovered Account",
    })
    let listAttempts = 0

    await restoreSession(page, "SUPERADMIN", {
      initialUsers: [previousAccount],
    })
    await page.route("**/api/users?**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback()
        return
      }
      listAttempts += 1
      if (listAttempts === 1) {
        await route.fulfill({
          json: { users: [previousAccount], total: 1, page: 1, pageSize: 10 },
        })
        return
      }
      if (listAttempts === 2) {
        await route.fulfill({
          status: 503,
          json: { error: "Account list is temporarily unavailable." },
        })
        return
      }
      await route.fulfill({
        json: { users: [recoveredAccount], total: 1, page: 1, pageSize: 10 },
      })
    })

    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(
      table.getByText("Previous Account", { exact: true }),
    ).toBeVisible()
    await page.getByPlaceholder("Search name or email").fill("Recovered")
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Account list is temporarily unavailable." }),
    ).toBeVisible()
    await expect(
      table.getByText("Previous Account", { exact: true }),
    ).toHaveCount(0)
    await expect(
      table.getByText("Recovered Account", { exact: true }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await expect(
      table.getByText("Recovered Account", { exact: true }),
    ).toBeVisible()
    expect(listAttempts).toBe(3)
  })

  test("[NEX-021] account creation rejects invalid email, name, phone, and password fields before submission", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN")
    let createAttempts = 0
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/users"
      ) {
        createAttempts += 1
      }
    })

    await page.goto("/accounts")
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    const dialog = page.getByRole("dialog", { name: "Create account" })
    const email = dialog.getByLabel("Email address")
    const name = dialog.getByLabel("Full name")
    const phone = dialog.getByLabel("Contact number")
    const password = dialog.getByLabel(/^Password/)
    const confirmation = dialog.getByLabel(/^Confirm password/)

    await email.fill("not-an-email")
    await name.fill("Jo@ne")
    await phone.fill("12345678901")
    await password.fill("lowercasepassword123!")
    await confirmation.fill("differentpassword123!")
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()

    await expect(
      dialog.getByText("Enter a valid email like name@example.com."),
    ).toBeVisible()
    await expect(
      dialog.getByText(
        "Letters, spaces, hyphens, apostrophes and periods only.",
      ),
    ).toBeVisible()
    await expect(
      dialog.getByText("Enter 11 digits starting with 09 or 08."),
    ).toBeVisible()
    await expect(
      dialog.getByText("Include at least one capital letter."),
    ).toBeVisible()
    await expect(dialog.getByText("Passwords do not match.")).toBeVisible()

    await name.fill("A")
    await expect(
      dialog.getByText("Full name must be at least 2 characters."),
    ).toBeVisible()
    expect(createAttempts).toBe(0)
    await expect(dialog).toBeVisible()
  })

  test("[NEX-022] role and status API failures keep their changes available for retry", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "user-target",
      email: "target@example.com",
      fullName: "Target User",
    })
    const users = [accountFor("SUPERADMIN"), target]
    let roleAttempts = 0
    let statusAttempts = 0

    await restoreSession(page, "SUPERADMIN", { initialUsers: users })
    await page.route("**/api/users/user-target/role", async (route) => {
      roleAttempts += 1
      expect(route.request().method()).toBe("PATCH")
      expect(route.request().postDataJSON()).toEqual({ role: "STAFF" })
      if (roleAttempts === 1) {
        await route.fulfill({
          status: 503,
          json: { error: "Role update is temporarily unavailable." },
        })
        return
      }
      Object.assign(target, { role: "STAFF" })
      await route.fulfill({ json: { user: target } })
    })
    await page.route("**/api/users/user-target/status", async (route) => {
      statusAttempts += 1
      expect(route.request().method()).toBe("PATCH")
      expect(route.request().postDataJSON()).toEqual({ isActive: false })
      if (statusAttempts === 1) {
        await route.fulfill({
          status: 503,
          json: { error: "Status update is temporarily unavailable." },
        })
        return
      }
      Object.assign(target, { isActive: false })
      await route.fulfill({ json: { user: target } })
    })

    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(table.getByText("Target User", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "Role for target@example.com: Client" })
      .click()
    await page.getByRole("menuitemradio", { name: "Staff" }).click()
    const save = page.getByRole("button", { name: "Save changes" })
    await save.click()
    await expect(page.locator("p[role=alert]")).toContainText(
      "Couldn't save 1 change. target@example.com: Role update is temporarily unavailable.",
    )
    await expect(save).toBeEnabled()
    await save.click()
    await expect(
      page.getByRole("button", { name: "Role for target@example.com: Staff" }),
    ).toBeVisible()
    expect(roleAttempts).toBe(2)

    await page
      .getByRole("button", { name: "More actions for target@example.com" })
      .click()
    await page.getByRole("menuitem", { name: "Deactivate account" }).click()
    const statusDialog = page.getByRole("dialog")
    await statusDialog
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()
    await expect(statusDialog.getByRole("alert")).toHaveText(
      "Status update is temporarily unavailable.",
    )
    await statusDialog
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()
    await expect(statusDialog).toHaveCount(0)
    await expect(table.getByText("Inactive", { exact: true })).toBeVisible()
    expect(statusAttempts).toBe(2)
  })

  test("[NEX-023] canceling status and deletion confirmations does not send those mutations", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "user-target",
      email: "target@example.com",
      fullName: "Target User",
    })
    let statusRequests = 0
    let trashRequests = 0
    let permanentDeleteRequests = 0

    await restoreSession(page, "SUPERADMIN", { initialUsers: [target] })
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (
        url.pathname === "/api/users/user-target/status" &&
        request.method() === "PATCH"
      ) {
        statusRequests += 1
      }
      if (
        url.pathname === "/api/users/user-target" &&
        request.method() === "DELETE"
      ) {
        trashRequests += 1
      }
      if (
        url.pathname === "/api/users/user-target/permanent" &&
        request.method() === "DELETE"
      ) {
        permanentDeleteRequests += 1
      }
    })

    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    const openActions = async () =>
      page
        .getByRole("button", { name: "More actions for target@example.com" })
        .click()

    await expect(table.getByText("Target User", { exact: true })).toBeVisible()
    await openActions()
    await page.getByRole("menuitem", { name: "Deactivate account" }).click()
    const statusDialog = page.getByRole("dialog")
    await statusDialog.getByRole("button", { name: "Cancel" }).click()
    await expect(statusDialog).toHaveCount(0)
    expect(statusRequests).toBe(0)
    await expect(table.getByText("Active", { exact: true })).toBeVisible()

    await openActions()
    await page.getByRole("menuitem", { name: "Deactivate account" }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()
    await expect(table.getByText("Inactive", { exact: true })).toBeVisible()
    expect(statusRequests).toBe(1)

    await openActions()
    await page.getByRole("menuitem", { name: "Move to trash" }).click()
    const trashDialog = page.getByRole("dialog")
    await trashDialog.getByRole("button", { name: "Cancel" }).click()
    await expect(trashDialog).toHaveCount(0)
    expect(trashRequests).toBe(0)
    await expect(table.getByText("Target User", { exact: true })).toBeVisible()

    await openActions()
    await page.getByRole("menuitem", { name: "Move to trash" }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Move to Trash", exact: true })
      .click()
    await expect(table.getByText("Target User", { exact: true })).toBeHidden()
    expect(trashRequests).toBe(1)

    await page.getByRole("button", { name: "Trash", exact: true }).click()
    await expect(table.getByText("Target User", { exact: true })).toBeVisible()
    await openActions()
    await page.getByRole("menuitem", { name: "Delete permanently" }).click()
    const permanentDialog = page.getByRole("dialog")
    await permanentDialog.getByRole("button", { name: "Cancel" }).click()
    await expect(permanentDialog).toHaveCount(0)
    expect(permanentDeleteRequests).toBe(0)
    await expect(table.getByText("Target User", { exact: true })).toBeVisible()
  })
})
