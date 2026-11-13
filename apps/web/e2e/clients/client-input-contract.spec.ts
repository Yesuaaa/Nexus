import { expect, test, type Page } from "@playwright/test"
import type {
  Client,
  ClientInput,
  ClientSort,
} from "../../src/features/clients/api/clients-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

async function openCreateForm(
  page: Page,
  options: { holdSubmission?: boolean; failFirstSubmission?: boolean } = {},
) {
  await restoreSession(page, "ADMIN")
  const clients: Client[] = []
  const submissions: ClientInput[] = []
  const releasePendingSubmissions: (() => void)[] = []
  let resolvePendingSubmission: (() => void) | null = null
  const pendingSubmission = new Promise<void>((resolve) => {
    resolvePendingSubmission = resolve
  })

  await page.route("**/api/clients**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname !== "/api/clients") return route.fallback()

    if (request.method() === "GET")
      return route.fulfill({
        json: { clients, total: clients.length, page: 1, pageSize: 10 },
      })

    if (request.method() === "POST") {
      const input = request.postDataJSON() as ClientInput
      submissions.push(input)
      if (options.failFirstSubmission && submissions.length === 1)
        return route.abort("failed")
      if (options.holdSubmission)
        await new Promise<void>((resolve) => {
          releasePendingSubmissions.push(resolve)
          resolvePendingSubmission?.()
        })
      const client: Client = {
        id: `client-${submissions.length}`,
        fullName: input.fullName,
        email: input.email,
        contactNumber: input.contactNumber,
        isActive: input.isActive,
        createdAt: "2026-11-13T00:00:00.000Z",
      }
      clients.push(client)
      return route.fulfill({ status: 201, json: { client } })
    }

    return route.fallback()
  })

  await page.goto("/clients")
  await page.getByRole("button", { name: "Create Client", exact: true }).click()
  return {
    dialog: page.getByRole("dialog"),
    submissions,
    waitForPendingSubmission: () => pendingSubmission,
    releaseSubmission: () => {
      for (const release of releasePendingSubmissions.splice(0)) release()
    },
  }
}

test("[NEX-024] client creation accepts minimum profile boundaries and trims name and contact", async ({
  page,
}) => {
  const { dialog, submissions } = await openCreateForm(page)
  const password = "clientpass12"

  await dialog.getByLabel("Full Name").fill("  李山  ")
  await dialog.getByLabel("Email Address").fill("li@example.com")
  await dialog.getByLabel("Contact Number").fill(" 1234567 ")
  await dialog.getByLabel("Initial Password").fill(password)
  await dialog.getByRole("button", { name: "Create Client" }).click()

  await expect(dialog).toHaveCount(0)
  expect(submissions).toEqual([
    {
      fullName: "李山",
      email: "li@example.com",
      contactNumber: "1234567",
      isActive: true,
      password,
    },
  ])
  await expect(
    page.getByRole("button", { name: "View 李山", exact: true }),
  ).toBeVisible()
})

test("[NEX-025] client creation accepts exact name, email, contact, and password UI maxima", async ({
  page,
}) => {
  const { dialog, submissions } = await openCreateForm(page)
  const fullName = "C".repeat(100)
  const email = `${"a".repeat(64)}@${"d".repeat(63)}.${"e".repeat(63)}.${"f".repeat(57)}.com`
  const contactNumber = "12345678901234567890"
  const password = "p".repeat(256)
  expect(email).toHaveLength(254)

  await expect(dialog.getByLabel("Full Name")).toHaveAttribute(
    "maxlength",
    "100",
  )
  await expect(dialog.getByLabel("Email Address")).toHaveAttribute(
    "maxlength",
    "254",
  )
  await expect(dialog.getByLabel("Contact Number")).toHaveAttribute(
    "maxlength",
    "20",
  )
  await expect(dialog.getByLabel("Initial Password")).toHaveAttribute(
    "maxlength",
    "256",
  )

  await dialog.getByLabel("Full Name").fill(fullName)
  await dialog.getByLabel("Email Address").fill(email)
  await dialog.getByLabel("Contact Number").fill(contactNumber)
  await dialog.getByLabel("Initial Password").fill(password)
  await dialog.getByRole("button", { name: "Create Client" }).click()

  await expect(dialog).toHaveCount(0)
  expect(submissions).toHaveLength(1)
  expect(submissions[0]).toMatchObject({
    fullName,
    email,
    contactNumber,
    isActive: true,
    password,
  })
})

test("[NEX-026] client creation rejects short names and malformed or short contact numbers before posting", async ({
  page,
}) => {
  const { dialog, submissions } = await openCreateForm(page)
  const fullName = dialog.getByLabel("Full Name")
  await fullName.fill("A")
  await dialog.getByLabel("Email Address").fill("client@example.com")
  await dialog.getByLabel("Contact Number").fill("09123456789")
  await dialog.getByLabel("Initial Password").fill("clientpass12")
  await dialog.getByRole("button", { name: "Create Client" }).click()
  await expect(dialog.locator("[data-field-error]")).toHaveCount(1)
  await expect(fullName).toHaveAccessibleDescription(
    "Enter at least 2 characters.",
  )
  expect(submissions).toHaveLength(0)

  await fullName.fill("Client Example")
  for (const contactNumber of ["123456", "12345x7"]) {
    await dialog.getByLabel("Contact Number").fill(contactNumber)
    await dialog.getByRole("button", { name: "Create Client" }).click()
    await expect(dialog.getByRole("alert")).toContainText(
      "valid contact number",
    )
    expect(submissions).toHaveLength(0)
  }
})

test("[NEX-027] client directory trims search, combines active filtering and sorting, and paginates results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await restoreSession(page, "ADMIN")

  const clients: Client[] = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1
    const suffix = String(number).padStart(2, "0")
    return {
      id: `client-${suffix}`,
      fullName: `Directory Client ${suffix}`,
      email: `client-${suffix}@example.test`,
      contactNumber: "09123456789",
      isActive: number % 2 === 0,
      createdAt: new Date(Date.UTC(2026, 10, number)).toISOString(),
    }
  })
  const requests: URL[] = []

  await page.route("**/api/clients?**", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const search = (url.searchParams.get("search") ?? "").toLowerCase()
    const status = url.searchParams.get("status") ?? ""
    const sortBy = (url.searchParams.get("sortBy") ?? "createdAt") as ClientSort
    const direction = url.searchParams.get("sortOrder") === "asc" ? 1 : -1
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const matching = clients
      .filter(
        (client) =>
          `${client.fullName} ${client.email}`.toLowerCase().includes(search) &&
          (!status ||
            (status === "ACTIVE" ? client.isActive : !client.isActive)),
      )
      .sort((left, right) => {
        const leftValue =
          sortBy === "isActive"
            ? String(left.isActive)
            : String(left[sortBy] ?? "")
        const rightValue =
          sortBy === "isActive"
            ? String(right.isActive)
            : String(right[sortBy] ?? "")
        return (
          leftValue.localeCompare(rightValue) * direction ||
          left.id.localeCompare(right.id)
        )
      })
    const pageSize = 10

    return route.fulfill({
      json: {
        clients: matching.slice(
          (pageNumber - 1) * pageSize,
          pageNumber * pageSize,
        ),
        total: matching.length,
        page: pageNumber,
        pageSize,
      },
    })
  })

  await page.goto("/clients")
  const table = page.getByRole("table", { name: "Clients" })
  await expect(
    table.getByText("Directory Client 12", { exact: true }),
  ).toBeVisible()
  expect(requests[0]?.searchParams.get("sortBy")).toBe("createdAt")
  expect(requests[0]?.searchParams.get("sortOrder")).toBe("desc")

  const nextPage = page
    .getByRole("navigation", { name: "Client pages" })
    .getByRole("button", { name: "Next page" })
  const secondPageRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === "/api/clients" && url.searchParams.get("page") === "2"
    )
  })
  await nextPage.click()
  const secondPageUrl = new URL((await secondPageRequest).url())
  expect(secondPageUrl.searchParams.get("page")).toBe("2")
  await expect(
    table.getByRole("row").filter({ hasText: "Directory Client 02" }).first(),
  ).toBeVisible()
  await expect(
    table.getByText("Directory Client 12", { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole("status")).toContainText("Showing 11–12 of 12")

  const searchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === "/api/clients" &&
      url.searchParams.get("search") === "Client 0" &&
      url.searchParams.get("page") === "1"
    )
  })
  await page
    .getByRole("searchbox", { name: "Search clients" })
    .fill(" Client 0 ")
  const searchUrl = new URL((await searchRequest).url())
  expect(searchUrl.searchParams.get("search")).toBe("Client 0")
  await expect(
    table.getByText("Directory Client 01", { exact: true }),
  ).toBeVisible()

  const activeFilterRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === "/api/clients" &&
      url.searchParams.get("search") === "Client 0" &&
      url.searchParams.get("status") === "ACTIVE"
    )
  })
  await page.getByRole("combobox", { name: "Filter by account status" }).click()
  await page.getByRole("option", { name: "Active", exact: true }).click()
  const activeFilterUrl = new URL((await activeFilterRequest).url())
  expect(activeFilterUrl.searchParams.get("page")).toBe("1")
  await expect(
    table.getByRole("row").filter({ hasText: "Directory Client 02" }).first(),
  ).toBeVisible()
  await expect(
    table.getByText("Directory Client 01", { exact: true }),
  ).toHaveCount(0)

  const sortRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === "/api/clients" &&
      url.searchParams.get("status") === "ACTIVE" &&
      url.searchParams.get("sortBy") === "fullName" &&
      url.searchParams.get("sortOrder") === "asc"
    )
  })
  await page.getByRole("combobox", { name: "Sort clients" }).click()
  await page.getByRole("option", { name: "Name: A to Z", exact: true }).click()
  const sortedUrl = new URL((await sortRequest).url())
  expect(sortedUrl.searchParams.get("search")).toBe("Client 0")
  expect(sortedUrl.searchParams.get("page")).toBe("1")
  await expect(
    table.getByRole("row").filter({ hasText: "Directory Client 04" }).first(),
  ).toBeVisible()
  await expect(
    table.getByRole("row").filter({ hasText: "Directory Client 08" }).first(),
  ).toBeVisible()
  await expect(page.getByRole("status")).toContainText("Showing 1–4 of 4")
})

test("[NEX-028] client creation preserves the selected inactive initial status", async ({
  page,
}) => {
  const { dialog, submissions } = await openCreateForm(page)

  await dialog.getByLabel("Full Name").fill("Inactive Client")
  await dialog.getByLabel("Email Address").fill("inactive@example.com")
  await dialog.getByLabel("Contact Number").fill("09123456789")
  await dialog.getByLabel("Initial Password").fill("clientpass12")
  await dialog.getByRole("combobox", { name: "Account Status" }).click()
  await page.getByRole("option", { name: "Inactive", exact: true }).click()
  await dialog.getByRole("button", { name: "Create Client" }).click()

  await expect(dialog).toHaveCount(0)
  expect(submissions).toHaveLength(1)
  expect(submissions[0]?.isActive).toBe(false)
  await expect(
    page
      .getByRole("table", { name: "Clients" })
      .getByRole("row")
      .filter({ hasText: "Inactive Client" })
      .first(),
  ).toContainText("Inactive")
})

test("[NEX-029] client form disables submission while one save is pending", async ({
  page,
}) => {
  const state = await openCreateForm(page, { holdSubmission: true })
  const { dialog, submissions } = state
  await dialog.getByLabel("Full Name").fill("Pending Client")
  await dialog.getByLabel("Email Address").fill("pending@example.com")
  await dialog.getByLabel("Contact Number").fill("09123456789")
  await dialog.getByLabel("Initial Password").fill("clientpass12")

  const submit = dialog.locator('button[type="submit"]')
  await expect(submit).toHaveAccessibleName("Create Client")
  await submit.dblclick()
  await state.waitForPendingSubmission()
  await expect(submit).toBeDisabled()
  await expect(dialog.getByLabel("Full Name")).toBeDisabled()
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(submissions).toHaveLength(1)

  state.releaseSubmission()
  await expect(dialog).toHaveCount(0)
  expect(submissions).toHaveLength(1)
})

test("[NEX-030] client creation retains values after a network failure and retries the same payload", async ({
  page,
}) => {
  const { dialog, submissions } = await openCreateForm(page, {
    failFirstSubmission: true,
  })
  await dialog.getByLabel("Full Name").fill("Retry Client")
  await dialog.getByLabel("Email Address").fill("retry@example.com")
  await dialog.getByLabel("Contact Number").fill("09123456789")
  await dialog.getByLabel("Initial Password").fill("clientpass12")

  await dialog.getByRole("button", { name: "Create Client" }).click()
  await expect(dialog.getByRole("alert")).toBeVisible()
  await expect(dialog.getByLabel("Full Name")).toHaveValue("Retry Client")
  await expect(dialog.getByLabel("Email Address")).toHaveValue(
    "retry@example.com",
  )
  expect(submissions).toHaveLength(1)

  await dialog.getByRole("button", { name: "Create Client" }).click()
  await expect(dialog).toHaveCount(0)
  expect(submissions).toHaveLength(2)
  expect(submissions[1]).toEqual(submissions[0])
  await expect(
    page.getByRole("button", { name: "View Retry Client", exact: true }),
  ).toBeVisible()
})
