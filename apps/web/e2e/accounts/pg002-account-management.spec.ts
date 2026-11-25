import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../../src/features/auth/model/types"
import { Permissions } from "../../src/features/auth/model/permissions"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

type ListQuery = Record<string, string | null>

function gate() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release: () => release() }
}

function makeAccountList(count = 12, prefix = "Target"): Account[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0")
    return accountFor("USER", {
      id: prefix.toLowerCase() + "-" + number,
      email: prefix.toLowerCase() + "-" + number + "@example.test",
      fullName: prefix + " Member " + number,
      contactNumber: "09123456789",
      isActive: true,
      accountDeletedAt: null,
      createdAt: "2026-01-" + number + "T00:00:00.000Z",
    })
  })
}

async function installAccountList(page: Page, accounts: Account[]) {
  const requests: URL[] = []
  await page.route(
    (url) => new URL(url).pathname === "/api/users",
    async (route) => {
      const request = route.request()
      if (request.method() !== "GET") {
        await route.fallback()
        return
      }

      const url = new URL(request.url())
      requests.push(url)
      const parameters = url.searchParams
      const trash = parameters.get("deleted") === "true"
      const search = (parameters.get("search") ?? "").toLowerCase()
      const role = parameters.get("role") ?? ""
      const sort = parameters.get("sort") ?? "createdAt"
      const direction = parameters.get("direction") ?? "desc"
      const pageNumber = Number(parameters.get("page") ?? "1")
      const matching = accounts
        .filter((account) => Boolean(account.accountDeletedAt) === trash)
        .filter((account) => !role || account.role === role)
        .filter(
          (account) =>
            !search ||
            account.email.toLowerCase().includes(search) ||
            (account.fullName?.toLowerCase().includes(search) ?? false),
        )
        .sort((left, right) => {
          let comparison = 0
          if (sort === "member")
            comparison = (left.fullName ?? "").localeCompare(
              right.fullName ?? "",
            )
          else if (sort === "role")
            comparison = left.role.localeCompare(right.role)
          else if (sort === "status")
            comparison = Number(left.isActive) - Number(right.isActive)
          else if (sort === "deletedAt" || sort === "createdAt")
            comparison =
              Date.parse(
                (sort === "deletedAt"
                  ? left.accountDeletedAt
                  : left.createdAt) ?? "",
              ) -
              Date.parse(
                (sort === "deletedAt"
                  ? right.accountDeletedAt
                  : right.createdAt) ?? "",
              )
          if (direction === "desc") comparison *= -1
          return comparison || left.id.localeCompare(right.id)
        })

      await route.fulfill({
        json: {
          users: matching.slice((pageNumber - 1) * 10, pageNumber * 10),
          total: matching.length,
          page: pageNumber,
          pageSize: 10,
        },
      })
    },
  )
  return requests
}

async function expectListRequest(
  requests: URL[],
  expected: ListQuery,
  fromIndex = 0,
) {
  await expect
    .poll(() =>
      requests
        .slice(fromIndex)
        .some((url) =>
          Object.entries(expected).every(([key, value]) =>
            value === null
              ? !url.searchParams.has(key)
              : url.searchParams.get(key) === value,
          ),
        ),
    )
    .toBe(true)
}

async function openCreateDialog(page: Page) {
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  return page.getByRole("dialog", { name: "Create account" })
}

async function fillCreateForm(
  dialog: ReturnType<Page["getByRole"]>,
  email: string,
  fullName: string,
  contactNumber = "",
) {
  await dialog.getByLabel("Email address").fill(email)
  await dialog.getByLabel("Full name").fill(fullName)
  if (contactNumber)
    await dialog.getByLabel("Contact number").fill(contactNumber)
  await dialog.getByLabel(/^Password/).fill("ValidPassword1!")
  await dialog.getByLabel(/^Confirm password/).fill("ValidPassword1!")
}

test.describe("PG-002 account management additions", () => {
  test.skip(
    process.env.NEXUS_E2E_LIVE === "1",
    "These deterministic account cases use isolated fixtures and API mocks.",
  )

  test("[PG-002-F001-A001-T002] direct route access requires SUPERADMIN and accounts:read", async ({
    browser,
  }) => {
    const cases: Array<{
      role?: Account["role"]
      account?: Partial<Account>
      destination: string
    }> = [
      {
        role: "SUPERADMIN",
        account: {
          permissions: accountFor("SUPERADMIN").permissions.filter(
            (permission) => permission !== Permissions.ACCOUNTS_READ,
          ),
        },
        destination: "/module",
      },
      {
        role: "ADMIN",
        account: {
          permissions: [
            ...accountFor("ADMIN").permissions,
            Permissions.ACCOUNTS_READ,
          ],
        },
        destination: "/module",
      },
      { role: "USER", destination: "/dashboard" },
      { destination: "/login" },
    ]

    for (const scenario of cases) {
      const context = await browser.newContext({
        baseURL: process.env.NEXUS_E2E_BASE_URL ?? "http://127.0.0.1:5273",
      })
      const deniedPage = await context.newPage()
      let listRequests = 0
      deniedPage.on("request", (request) => {
        const url = new URL(request.url())
        if (url.pathname === "/api/users" && request.method() === "GET")
          listRequests += 1
      })
      if (scenario.role) {
        await restoreSession(deniedPage, scenario.role, {
          account: scenario.account,
          initialUsers: [],
        })
      }
      await deniedPage.goto("/accounts")
      await expect
        .poll(() => new URL(deniedPage.url()).pathname)
        .toBe(scenario.destination)
      expect(listRequests).toBe(0)
      await context.close()
    }
  })

  test("[PG-002-F001-A001-T004] active, no-match and Trash empty states are distinct", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN", { initialUsers: [] })
    const requests = await installAccountList(page, [])
    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(
      table.getByText("No accounts match your search.", { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0)

    await page.getByPlaceholder("Search name or email").fill("missing-record")
    await expectListRequest(requests, { search: "missing-record" })
    await expect(
      table.getByText("No accounts match your search.", { exact: true }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Trash", exact: true }).click()
    await expectListRequest(requests, {
      search: "missing-record",
      deleted: "true",
      page: "1",
    })
    await expect(
      table.getByText("No soft-deleted accounts match your search.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0)
  })

  test("[PG-002-F001-A002-T005] Accounts and Trash preserve search and role while resetting query defaults", async ({
    page,
  }) => {
    const active = makeAccountList()
    const trashed = accountFor("USER", {
      id: "target-trashed",
      email: "target-trashed@example.test",
      fullName: "Target Trashed",
      contactNumber: "09123456789",
      isActive: false,
      accountDeletedAt: "2026-10-01T00:00:00.000Z",
    })
    await restoreSession(page, "SUPERADMIN", {
      initialUsers: [...active, trashed],
    })
    const requests = await installAccountList(page, [...active, trashed])
    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(
      table.getByText("Target Member 12", { exact: true }),
    ).toBeVisible()

    await page.getByPlaceholder("Search name or email").fill("Target")
    await expectListRequest(requests, { search: "Target", page: "1" })
    await page
      .getByRole("combobox", { name: "Filter by role: All roles" })
      .click()
    await page.getByRole("option", { name: "Client", exact: true }).click()
    await expectListRequest(requests, {
      search: "Target",
      role: "USER",
      page: "1",
    })
    await page.getByRole("button", { name: "Sort by Member" }).click()
    await expectListRequest(requests, {
      search: "Target",
      role: "USER",
      page: "1",
      sort: "member",
      direction: "asc",
    })

    await page.getByRole("button", { name: "Next page" }).click()
    await expectListRequest(requests, {
      search: "Target",
      role: "USER",
      page: "2",
      sort: "member",
      direction: "asc",
    })
    await expect(
      table.getByText("Target Member 11", { exact: true }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Trash", exact: true }).click()
    await expectListRequest(requests, {
      search: "Target",
      role: "USER",
      page: "1",
      sort: "deletedAt",
      direction: null,
      deleted: "true",
    })
    await expect(
      table.getByText("Target Trashed", { exact: true }),
    ).toBeVisible()

    await page
      .getByRole("button", { name: "Back to Accounts", exact: true })
      .click()
    await expectListRequest(requests, {
      search: "Target",
      role: "USER",
      page: "1",
      sort: null,
      direction: null,
      deleted: null,
    })
    await expect(
      table.getByText("Target Member 12", { exact: true }),
    ).toBeVisible()
  })

  test("[PG-002-F001-A002-T006] visible sort controls request supported keys and direction changes from page one", async ({
    page,
  }) => {
    const active = makeAccountList()
    const trashed = makeAccountList(12, "Archived").map((account, index) => ({
      ...account,
      id: "archived-" + String(index + 1).padStart(2, "0"),
      email: "archived-" + String(index + 1).padStart(2, "0") + "@example.test",
      fullName: "Archived Member " + String(index + 1).padStart(2, "0"),
      isActive: false,
      accountDeletedAt:
        "2026-10-" + String(index + 1).padStart(2, "0") + "T00:00:00.000Z",
    }))
    await restoreSession(page, "SUPERADMIN", {
      initialUsers: [...active, ...trashed],
    })
    const requests = await installAccountList(page, [...active, ...trashed])
    await page.goto("/accounts")
    await expectListRequest(requests, { page: "1" })

    const moveToSecondPage = async () => {
      const start = requests.length
      await expect(
        page.getByRole("button", { name: "Next page" }),
      ).toBeEnabled()
      await page.getByRole("button", { name: "Next page" }).click()
      await expectListRequest(requests, { page: "2" }, start)
    }
    const sortAndCheck = async (
      label: string,
      sort: string | null,
      direction: string | null,
    ) => {
      const start = requests.length
      await page.getByRole("button", { name: "Sort by " + label }).click()
      await expectListRequest(requests, { page: "1", sort, direction }, start)
    }

    await moveToSecondPage()
    await sortAndCheck("Member", "member", "asc")
    await sortAndCheck("Member", "member", null)
    await moveToSecondPage()
    await sortAndCheck("Role", "role", "asc")
    await sortAndCheck("Role", "role", null)
    await moveToSecondPage()
    await sortAndCheck("Status", "status", "asc")
    await sortAndCheck("Status", "status", null)
    await moveToSecondPage()
    await sortAndCheck("Created", null, null)
    await sortAndCheck("Created", null, "asc")

    await page.getByRole("button", { name: "Trash", exact: true }).click()
    await expectListRequest(requests, {
      page: "1",
      sort: "deletedAt",
      direction: null,
      deleted: "true",
    })
    await moveToSecondPage()
    await sortAndCheck("Deletion status", "status", "asc")
    await sortAndCheck("Deletion status", "status", null)
    await moveToSecondPage()
    await sortAndCheck("Deleted", "deletedAt", "asc")
    await sortAndCheck("Deleted", "deletedAt", null)
  })

  test("[PG-002-F001-A002-T007] a superseded search response cannot replace the newer result", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN", { initialUsers: [] })
    const oldStarted = gate()
    const releaseOld = gate()
    let oldHandlerFinished = false
    const oldAccount = accountFor("USER", {
      id: "old-search-result",
      email: "old@example.test",
      fullName: "Old Search Result",
    })
    const newAccount = accountFor("USER", {
      id: "new-search-result",
      email: "new@example.test",
      fullName: "New Search Result",
    })
    await page.route(
      (url) => new URL(url).pathname === "/api/users",
      async (route) => {
        const requestUrl = new URL(route.request().url())
        const search = requestUrl.searchParams.get("search")
        if (search === "Old") {
          oldStarted.release()
          await releaseOld.promise
          try {
            await route.fulfill({
              json: { users: [oldAccount], total: 1, page: 1, pageSize: 10 },
            })
          } catch {
            // The page may abort a superseded query while this route is held.
          } finally {
            oldHandlerFinished = true
          }
          return
        }
        const users = search === "New" ? [newAccount] : []
        await route.fulfill({
          json: { users, total: users.length, page: 1, pageSize: 10 },
        })
      },
    )
    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await page.getByPlaceholder("Search name or email").fill("Old")
    await oldStarted.promise
    await page.getByPlaceholder("Search name or email").fill("New")
    await expect(
      table.getByText("New Search Result", { exact: true }),
    ).toBeVisible()
    releaseOld.release()
    await expect.poll(() => oldHandlerFinished).toBe(true)
    await expect(
      table.getByText("New Search Result", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Old Search Result", { exact: true }),
    ).toHaveCount(0)
  })

  test("[PG-002-F001-A003-T008] create enforces supported name lengths and omits a blank optional contact", async ({
    page,
  }) => {
    const accounts: Account[] = []
    const bodies: Array<{
      email: string
      fullName: string
      contactNumber?: string
      password: string
      role: Account["role"]
    }> = []
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) => new URL(url).pathname === "/api/users",
      async (route) => {
        if (route.request().method() !== "POST") {
          await route.fallback()
          return
        }
        const body = route.request().postDataJSON() as (typeof bodies)[number]
        bodies.push(body)
        const created = accountFor(body.role, {
          id: "created-" + String(bodies.length),
          email: body.email,
          fullName: body.fullName,
          contactNumber: body.contactNumber ?? null,
        })
        accounts.push(created)
        await route.fulfill({ status: 201, json: { user: created } })
      },
    )
    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })

    let dialog = await openCreateDialog(page)
    await fillCreateForm(dialog, "short-name@example.test", "A")
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await expect(
      dialog.getByText("Full name must be at least 2 characters."),
    ).toBeVisible()
    expect(bodies).toHaveLength(0)

    dialog = await openCreateDialog(page)
    await fillCreateForm(dialog, "two-char@example.test", "Jo")
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(table.getByText("Jo", { exact: true })).toBeVisible()

    dialog = await openCreateDialog(page)
    const hundredCharacterName = "A".repeat(100)
    await fillCreateForm(
      dialog,
      "hundred-char@example.test",
      hundredCharacterName,
    )
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(
      table.getByText(hundredCharacterName, { exact: true }),
    ).toBeVisible()
    expect(bodies.map((body) => body.fullName)).toEqual([
      "Jo",
      hundredCharacterName,
    ])
    expect(bodies.every((body) => body.contactNumber === undefined)).toBe(true)
  })

  test("[PG-002-F001-A003-T009] a pending create submission cannot be triggered twice", async ({
    page,
  }) => {
    const accounts: Account[] = []
    const requestStarted = gate()
    const releaseRequest = gate()
    let attempts = 0
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) => new URL(url).pathname === "/api/users",
      async (route) => {
        if (route.request().method() !== "POST") {
          await route.fallback()
          return
        }
        attempts += 1
        requestStarted.release()
        await releaseRequest.promise
        const created = accountFor("USER", {
          id: "pending-create",
          email: "pending-create@example.test",
          fullName: "Pending Create",
        })
        accounts.push(created)
        await route.fulfill({ status: 201, json: { user: created } })
      },
    )
    await page.goto("/accounts")
    const dialog = await openCreateDialog(page)
    await fillCreateForm(
      dialog,
      "pending-create@example.test",
      "Pending Create",
    )
    const submit = dialog.getByRole("button", {
      name: "Create account",
      exact: true,
    })
    await submit.click()
    await requestStarted.promise
    const pendingSubmit = dialog.getByRole("button", {
      name: "Creating…",
      exact: true,
    })
    await expect(pendingSubmit).toBeDisabled()
    await dialog.getByLabel("Full name").press("Enter")
    expect(attempts).toBe(1)
    releaseRequest.release()
    await expect(dialog).toHaveCount(0)
    await expect(
      page
        .getByRole("table", { name: "Accounts", exact: true })
        .getByText("Pending Create", { exact: true }),
    ).toBeVisible()
    expect(attempts).toBe(1)
  })

  test("[PG-002-F001-A004-T011] profile and role edits recover after an API failure", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "pg002-edit-target",
      email: "edit-before@example.test",
      fullName: "Edit Before",
      contactNumber: "09123456789",
    })
    const accounts = [target]
    let attempts = 0
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) => new URL(url).pathname === "/api/users/pg002-edit-target",
      async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.fallback()
          return
        }
        attempts += 1
        expect(route.request().postDataJSON()).toEqual({
          fullName: "Edit After",
          email: "edit-after@example.test",
          contactNumber: "09123456789",
          role: "STAFF",
        })
        if (attempts === 1) {
          await route.fulfill({
            status: 503,
            json: { error: "Account update is temporarily unavailable." },
          })
          return
        }
        Object.assign(target, {
          fullName: "Edit After",
          email: "edit-after@example.test",
          contactNumber: "09123456789",
          role: "STAFF",
        })
        await route.fulfill({ json: { user: target } })
      },
    )
    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(table.getByText("Edit Before", { exact: true })).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for edit-before@example.test",
      })
      .click()
    await page
      .getByRole("menuitem", { name: "Edit account", exact: true })
      .click()
    const panel = page.getByRole("dialog")
    await panel.getByLabel("Full name").fill("Edit After")
    await panel.getByLabel("Email address").fill("edit-after@example.test")
    await panel.getByLabel("Contact number").fill("09123456789")
    await panel.getByRole("combobox", { name: "Account role" }).click()
    await page.getByRole("option", { name: "Staff", exact: true }).click()
    const save = panel.getByRole("button", { name: "Save changes" })
    await save.click()
    await expect(panel.getByRole("alert")).toHaveText(
      "Account update is temporarily unavailable.",
    )
    await expect(save).toBeEnabled()
    await save.click()
    await expect(table.getByText("Edit After", { exact: true })).toBeVisible()
    await expect(
      table.getByText("edit-after@example.test", { exact: true }),
    ).toBeVisible()
    expect(attempts).toBe(2)
  })

  test("[PG-002-F001-A005-T012] a pending status change disables duplicate confirmation", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "pg002-status-target",
      email: "status-target@example.test",
      fullName: "Status Target",
    })
    const accounts = [target]
    const requestStarted = gate()
    const releaseRequest = gate()
    let attempts = 0
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) =>
        new URL(url).pathname === "/api/users/pg002-status-target/status",
      async (route) => {
        attempts += 1
        requestStarted.release()
        await releaseRequest.promise
        target.isActive = false
        await route.fulfill({ json: { user: target } })
      },
    )
    await page.goto("/accounts")
    await page
      .getByRole("button", {
        name: "More actions for status-target@example.test",
      })
      .click()
    await page.getByRole("menuitem", { name: "Deactivate account" }).click()
    const dialog = page.getByRole("dialog")
    const confirm = dialog.getByRole("button", {
      name: "Deactivate account",
      exact: true,
    })
    await confirm.click()
    await requestStarted.promise
    await expect(
      dialog.getByRole("button", { name: "Saving..." }),
    ).toBeDisabled()
    await dialog.press("Enter")
    expect(attempts).toBe(1)
    releaseRequest.release()
    await expect(dialog).toHaveCount(0)
    expect(attempts).toBe(1)
  })

  test("[PG-002-F001-A007-T013] a failed move to Trash stays retryable and removes the account after success", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "pg002-trash-retry",
      email: "trash-retry@example.test",
      fullName: "Trash Retry",
      isActive: false,
      accountDeletedAt: null,
    })
    const accounts = [target]
    let attempts = 0
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) => new URL(url).pathname === "/api/users/pg002-trash-retry",
      async (route) => {
        if (route.request().method() !== "DELETE") {
          await route.fallback()
          return
        }
        attempts += 1
        if (attempts === 1) {
          await route.fulfill({
            status: 503,
            json: { error: "Trash is temporarily unavailable." },
          })
          return
        }
        target.accountDeletedAt = "2026-10-15T00:00:00.000Z"
        await route.fulfill({ json: { message: "Account moved to Trash" } })
      },
    )
    await page.goto("/accounts")
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(table.getByText("Trash Retry", { exact: true })).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for trash-retry@example.test",
      })
      .click()
    await page.getByRole("menuitem", { name: "Move to trash" }).click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: "Move to Trash", exact: true })
      .click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Trash is temporarily unavailable.",
    )
    const retry = dialog.getByRole("button", {
      name: "Move to Trash",
      exact: true,
    })
    await expect(retry).toBeEnabled()
    await retry.click()
    await expect(dialog).toHaveCount(0)
    await expect(table.getByText("Trash Retry", { exact: true })).toHaveCount(0)
    expect(attempts).toBe(2)

    await page.getByRole("button", { name: "Trash", exact: true }).click()
    await expect(table.getByText("Trash Retry", { exact: true })).toBeVisible()
  })

  test("[PG-002-F001-A009-T014] permanent-delete conflict is visible and the trashed account remains", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "pg002-linked-trash",
      email: "linked-trash@example.test",
      fullName: "Linked Trash Account",
      isActive: false,
      accountDeletedAt: "2026-10-15T00:00:00.000Z",
    })
    const accounts = [target]
    let attempts = 0
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) =>
        new URL(url).pathname === "/api/users/pg002-linked-trash/permanent",
      async (route) => {
        attempts += 1
        await route.fulfill({
          status: 409,
          json: {
            error:
              "This account has related records and cannot be permanently deleted. Keep it in Trash to preserve its history.",
          },
        })
      },
    )
    await page.goto("/accounts")
    await page.getByRole("button", { name: "Trash", exact: true }).click()
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(
      table.getByText("Linked Trash Account", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for linked-trash@example.test",
      })
      .click()
    await page.getByRole("menuitem", { name: "Delete permanently" }).click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: "Delete Permanently", exact: true })
      .click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "This account has related records and cannot be permanently deleted. Keep it in Trash to preserve its history.",
    )
    await expect(
      table.getByText("Linked Trash Account", { exact: true }),
    ).toBeVisible()
    expect(attempts).toBe(1)
  })

  test("[PG-002-F001-A009-T015] a pending permanent deletion disables duplicate confirmation", async ({
    page,
  }) => {
    const target = accountFor("USER", {
      id: "pg002-permanent-pending",
      email: "permanent-pending@example.test",
      fullName: "Permanent Pending",
      isActive: false,
      accountDeletedAt: "2026-10-15T00:00:00.000Z",
    })
    const accounts = [target]
    const requestStarted = gate()
    const releaseRequest = gate()
    let attempts = 0
    await restoreSession(page, "SUPERADMIN", { initialUsers: accounts })
    await installAccountList(page, accounts)
    await page.route(
      (url) =>
        new URL(url).pathname ===
        "/api/users/pg002-permanent-pending/permanent",
      async (route) => {
        attempts += 1
        requestStarted.release()
        await releaseRequest.promise
        accounts.splice(accounts.indexOf(target), 1)
        await route.fulfill({
          json: { message: "Account permanently deleted" },
        })
      },
    )
    await page.goto("/accounts")
    await page.getByRole("button", { name: "Trash", exact: true }).click()
    const table = page.getByRole("table", { name: "Accounts", exact: true })
    await expect(
      table.getByText("Permanent Pending", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for permanent-pending@example.test",
      })
      .click()
    await page.getByRole("menuitem", { name: "Delete permanently" }).click()
    const dialog = page.getByRole("dialog")
    const confirm = dialog.getByRole("button", {
      name: "Delete Permanently",
      exact: true,
    })
    await confirm.click()
    await requestStarted.promise
    await expect(
      dialog.getByRole("button", { name: "Deleting..." }),
    ).toBeDisabled()
    await dialog.press("Enter")
    expect(attempts).toBe(1)
    releaseRequest.release()
    await expect(dialog).toHaveCount(0)
    await expect(
      table.getByText("Permanent Pending", { exact: true }),
    ).toHaveCount(0)
    expect(attempts).toBe(1)
  })
})
