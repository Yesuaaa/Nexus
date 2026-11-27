import { test, expect, type Page } from "@playwright/test"
import type {
  BookingDetails,
  BookingList,
} from "../../src/features/bookings/api/bookings-api"
import {
  restoreSession,
  configureRegressionTest,
  storedTokens,
} from "../regression-support"

configureRegressionTest()

function booking(index = 1): BookingDetails {
  return {
    id: `pg017-${index}`,
    referenceNumber: `PG017-${index}`,
    title: `Website request ${index}`,
    status: "SUBMITTED",
    packageName: "Synthetic package",
    expectedTimeline: "Four weeks",
    preferredSpecialistName: "Synthetic specialist",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    service: { id: "service", name: `Website ${index}` },
    projectGoals: "Synthetic goals",
    projectRequirements: "Synthetic requirements",
    additionalDetails: "Synthetic notes",
  }
}
function gate() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
function result(
  rows: BookingDetails[],
  page = 1,
  total = rows.length,
): BookingList {
  return { serviceRequests: rows, total, page, pageSize: 10 }
}
async function setup(page: Page, initial = [booking()]) {
  await restoreSession(page, "USER")
  const state = {
    rows: initial,
    queries: [] as { search: string; page: number; status: string }[],
    detailIds: [] as string[],
    detailGate: null as ReturnType<typeof gate> | null,
    servedDetails: 0,
    listStatus: 200,
    load: null as ((url: URL) => Promise<BookingList> | BookingList) | null,
  }
  await page.route("**/api/service-requests**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/service-requests") {
      const currentPage = Number(url.searchParams.get("page") ?? 1)
      state.queries.push({
        search: url.searchParams.get("search") ?? "",
        status: url.searchParams.get("status") ?? "",
        page: currentPage,
      })
      if (state.listStatus !== 200)
        return route.fulfill({
          status: state.listStatus,
          json: { error: "Synthetic background failure" },
        })
      const data = state.load
        ? await state.load(url)
        : result(
            state.rows.slice((currentPage - 1) * 10, currentPage * 10),
            currentPage,
            state.rows.length,
          )
      return route.fulfill({ json: data })
    }
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!)
    state.detailIds.push(id)
    const row = state.rows.find((item) => item.id === id)
    await state.detailGate?.promise
    await route.fulfill(
      row
        ? { json: { serviceRequest: row } }
        : { status: 404, json: { error: "Booked service not found" } },
    )
    state.servedDetails++
  })
  return state
}
const table = (page: Page) =>
  page.getByRole("table", { name: "Booked services", exact: true })
const view = (page: Page, id = "pg017-1") =>
  page.getByRole("button", { name: "View booking " + id, exact: true })
const search = (page: Page) =>
  page.getByRole("searchbox", { name: "Search booked services", exact: true })
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Booking details", exact: true })

test("[PG-017-F001-A002-T003] obsolete search response cannot replace latest rows", async ({
  page,
}) => {
  const state = await setup(page)
  const old = gate()
  let oldServed = false
  state.load = async (url) => {
    if (url.searchParams.get("search") === "Old") {
      await old.promise
      oldServed = true
      return result([
        { ...booking(2), service: { id: "old", name: "Old response" } },
      ])
    }
    return result([
      { ...booking(), service: { id: "latest", name: "Latest response" } },
    ])
  }
  try {
    await page.goto("/booked-services")
    await expect(view(page)).toBeVisible()
    const first = page.waitForRequest(
      (r) => new URL(r.url()).searchParams.get("search") === "Old",
    )
    await search(page).fill("Old")
    await first
    const latestResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/service-requests" &&
        new URL(response.url()).searchParams.get("search") === "Latest",
    )
    await search(page).fill("Latest")
    await (await latestResponse).finished()
    await expect(
      table(page).getByText("Latest response", { exact: true }),
    ).toBeVisible()
    old.release()
    await expect.poll(() => oldServed).toBe(true)
    await expect(
      table(page).getByText("Old response", { exact: true }),
    ).toHaveCount(0)
    await expect(
      table(page).getByText("Latest response", { exact: true }),
    ).toBeVisible()
    expect(state.queries.at(-1)).toEqual({
      search: "Latest",
      status: "",
      page: 1,
    })
    await expect(
      page.getByText("Showing 1\u20131 of 1", { exact: true }),
    ).toBeVisible()
  } finally {
    old.release()
  }
})

test("[PG-017-F001-A002-T004] search is trimmed and resets the second page", async ({
  page,
}) => {
  const state = await setup(
    page,
    Array.from({ length: 11 }, (_, i) => booking(i + 1)),
  )
  state.load = (url) =>
    url.searchParams.get("search")
      ? result([booking()])
      : result(
          state.rows.slice(
            (Number(url.searchParams.get("page")) - 1) * 10,
            Number(url.searchParams.get("page")) * 10,
          ),
          Number(url.searchParams.get("page")),
          11,
        )
  await page.goto("/booked-services")
  await expect(view(page)).toBeVisible()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(view(page, "pg017-11")).toBeVisible()
  await search(page).fill("  Website  ")
  await expect(view(page)).toBeVisible()
  await expect
    .poll(() => state.queries.at(-1))
    .toEqual({ search: "Website", status: "", page: 1 })
})

test("[PG-017-F001-A005-T002] refresh clamps a page after the total shrinks", async ({
  page,
}) => {
  const state = await setup(
    page,
    Array.from({ length: 11 }, (_, i) => booking(i + 1)),
  )
  await page.goto("/booked-services")
  await expect(view(page)).toBeVisible()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(view(page, "pg017-11")).toBeVisible()
  state.rows = state.rows.slice(0, 9)
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(view(page)).toBeVisible()
  await expect.poll(() => state.queries.at(-1)?.page).toBe(1)
  await expect(
    page.getByText("Showing 1\u20139 of 9", { exact: true }),
  ).toBeVisible()
})

test("[PG-017-F001-A006-T002] successful empty list, search and status states are distinct", async ({
  page,
}) => {
  await setup(page, [])
  await page.goto("/booked-services")
  await expect(
    table(page).getByText(
      "You haven't booked any services yet. Browse Services to get started.",
      { exact: true },
    ),
  ).toBeVisible()
  await search(page).fill("No match")
  await expect(table(page).getByRole("status")).toContainText("No results for")
  await page.getByRole("button", { name: "Clear filters", exact: true }).click()
  await page
    .getByRole("combobox", { name: "Filter bookings by status", exact: true })
    .click()
  await page.getByRole("option", { name: "Under Review", exact: true }).click()
  await expect(
    table(page).getByText("No booked services match the selected filters.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    table(page).getByRole("button", { name: /^View booking / }),
  ).toHaveCount(0)
})

test("[PG-017-F001-A007-T002] list refresh updates an already open detail", async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto("/booked-services")
  await view(page).click()
  await expect(dialog(page).getByText("Pending", { exact: true })).toBeVisible()
  const before = state.detailIds.length
  state.rows[0]!.status = "UNDER_REVIEW"
  // The modal covers Refresh; the source-supported focus refresh uses the same list hook.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(
    dialog(page).getByText("Under Review", { exact: true }),
  ).toBeVisible()
  expect(state.detailIds.length).toBeGreaterThan(before)
  await page.keyboard.press("Escape")
  await expect(
    table(page).getByText("Under Review", { exact: true }),
  ).toBeVisible()
})

test("[PG-017-F001-A007-T003] failed background refresh retains accepted rows", async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto("/booked-services")
  await expect(view(page)).toBeVisible()
  state.listStatus = 503
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/service-requests" &&
      r.status() === 503,
  )
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await (await response).finished()
  await expect(view(page)).toBeVisible()
  await expect(table(page).getByRole("alert")).toHaveCount(0)
})

test("[PG-017-F001-A009-T001] a late detail response cannot reopen a closed drawer", async ({
  page,
}) => {
  const state = await setup(page)
  const delayed = gate()
  state.detailGate = delayed
  try {
    await page.goto("/booked-services")
    await view(page).click()
    await expect(dialog(page).getByRole("status")).toContainText(
      "Loading booking details",
    )
    await expect.poll(() => state.detailIds.length).toBeGreaterThan(0)
    await page.keyboard.press("Escape")
    await expect(dialog(page)).toHaveCount(0)
    delayed.release()
    await expect.poll(() => state.servedDetails).toBeGreaterThan(0)
    await expect(dialog(page)).toHaveCount(0)
    await expect(view(page)).toBeVisible()
  } finally {
    delayed.release()
  }
})

test("[PG-017-F001-A011-T002] repeated and overlength deep links do not request details", async ({
  page,
}) => {
  const state = await setup(page)
  for (const query of [
    "booking=pg017-1&booking=pg017-2",
    "booking=" + "x".repeat(201),
  ]) {
    await page.goto("/booked-services?" + query)
    await expect(view(page)).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    expect(state.detailIds).toEqual([])
  }
})

test("[PG-017-F001-A012-T002] missing optional booking values use documented fallbacks", async ({
  page,
}) => {
  await setup(page, [
    {
      ...booking(),
      packageName: null,
      preferredSpecialistName: null,
      additionalDetails: null,
      expectedTimeline: "",
    },
  ])
  await page.goto("/booked-services")
  await view(page).click()
  for (const label of [
    "Standard service",
    "Department to assign",
    "Not specified",
    "Not provided",
  ])
    await expect(dialog(page).getByText(label, { exact: true })).toBeVisible()
})

test("[PG-017-F001-A014-T003] expired access and rejected refresh clear the managed session", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let refreshes = 0
  await page.route("**/api/auth/refresh", async (route) => {
    refreshes++
    expect(route.request().postDataJSON()).toEqual({
      refreshToken: "test-refresh",
    })
    await route.fulfill({
      status: 401,
      json: { error: "Synthetic session expired" },
    })
  })
  await page.route("**/api/service-requests**", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Access expired", code: "ACCESS_TOKEN_EXPIRED" },
    }),
  )
  await page.goto("/booked-services")
  await expect.poll(() => refreshes).toBe(1)
  await expect.poll(() => storedTokens(page)).toEqual([null, null])
  await expect(
    page.getByRole("button", { name: /^View booking / }),
  ).toHaveCount(0)
})
