import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import type { BookingDetails } from "../src/features/bookings/api/bookings-api"
import type { InboxRequest } from "../src/features/request-inbox/api/request-inbox-api"

type RequestDetails = InboxRequest & BookingDetails
function fixture(index: number): RequestDetails {
  return {
    id: `booking-${index}`,
    referenceNumber: index === 11 ? null : `SR-INBOX-${index}`,
    title: "Website request",
    status: "SUBMITTED",
    packageName: "Business Website",
    expectedTimeline: "Launch in six weeks",
    preferredSpecialistName: "Sam Developer",
    createdAt: "2026-10-30T08:00:00Z",
    updatedAt: "2026-10-30T08:00:00Z",
    service: { id: "service-1", name: "Website Development" },
    client: {
      fullName: `Mara Client ${index}`,
      email: `client${index}@example.com`,
      contactNumber: "09123456789",
    },
    projectGoals: "Reach more customers.",
    projectRequirements: "Five accessible pages and a contact form.",
    additionalDetails: "Follow the brand guidelines.",
  }
}

for (const width of [1440, 390]) {
  test(`inbox rows refresh when a booking status changes elsewhere at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockInbox(page)
    state.requests = [fixture(1)]
    await page.goto("/request-inbox")
    await expect(page.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
    state.requests[0]!.status = "UNDER_REVIEW"
    state.requests[0]!.acceptedDepartmentId = "design"
    await expect(
      page.getByText("No requests match this view.", { exact: true }),
    ).toBeVisible({ timeout: 10_000 })
    await page
      .getByRole("combobox", { name: "Filter requests", exact: true })
      .click()
    await page
      .getByRole("option", { name: "All statuses", exact: true })
      .click()
    await expect(page.getByText("Under review", { exact: true })).toBeVisible()
    state.requests[0]!.status = "CLOSED"
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await expect(page.getByText("Closed", { exact: true })).toBeVisible()
    expect(state.queries.at(-1)).toContain("view=all")
  })
  test(`status filtering, sorting and exact-request chat feedback at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockInbox(page)
    state.requests.forEach((request, index) => {
      request.service.name = index % 2 ? "Zebra service" : "Alpha service"
    })
    state.requests.push({ ...fixture(12), status: "CANCELLED" })
    await page.goto("/request-inbox")
    await page
      .getByRole("button", {
        name: "Go to chat for request booking-1",
        exact: true,
      })
      .click()
    await expect(
      page.getByText(
        "Accept this request for your department before opening its conversation.",
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/request-inbox$/)
    await page
      .getByRole("combobox", { name: "Sort requests", exact: true })
      .selectOption("reference:desc")
    await expect.poll(() => state.queries.at(-1)).toContain("sortDir=desc")
    await page.getByRole("button", { name: "Page 2", exact: true }).click()
    await expect.poll(() => state.queries.at(-1)).toContain("page=2")
    expect(state.queries.at(-1)).toContain("sortBy=reference")
    expect(state.queries.at(-1)).toContain("sortDir=desc")
    await page
      .getByRole("combobox", { name: "Filter requests", exact: true })
      .click()
    await page.getByRole("option", { name: "Cancelled", exact: true }).click()
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
    await expect(page.getByText("SR-INBOX-12", { exact: true })).toBeVisible()
    expect(state.queries.at(-1)).toContain("page=1")
    await page
      .getByRole("combobox", { name: "Filter requests", exact: true })
      .click()
    await page.getByRole("option", { name: "Closed", exact: true }).click()
    await expect(
      page.getByText("No requests match this view.", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("combobox", { name: "Filter requests", exact: true })
      .click()
    await page
      .getByRole("option", { name: "All statuses", exact: true })
      .click()
    await expect(page.getByText("Showing 1–10 of 12")).toBeVisible()
    await page
      .getByRole("combobox", { name: "Sort requests", exact: true })
      .selectOption("service:asc")
    await expect.poll(() => state.queries.at(-1)).toContain("sortBy=service")
    if (width === 1440) {
      await page
        .getByRole("button", {
          name: "Sort by service, ascending",
          exact: true,
        })
        .click()
      await expect(
        page.getByRole("columnheader", { name: /service/i }),
      ).toHaveAttribute("aria-sort", "descending")
      await page
        .getByRole("button", { name: "Sort by reference", exact: true })
        .click()
      await expect(
        page.getByRole("columnheader", { name: /reference/i }),
      ).toHaveAttribute("aria-sort", "ascending")
    }
    await page.screenshot({
      path: `test-results/issue142-inbox-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test("chat icons open the exact accepted request and report access failures", async ({
  page,
}) => {
  const state = await mockInbox(page)
  state.requests[0]!.status = "UNDER_REVIEW"
  state.requests[0]!.acceptedDepartmentId = "design"
  state.conversationError = true
  await page.goto("/request-inbox")
  await page
    .getByRole("combobox", { name: "Filter requests", exact: true })
    .click()
  await page.getByRole("option", { name: "Under review", exact: true }).click()
  await page
    .getByRole("button", {
      name: "Go to chat for request booking-1",
      exact: true,
    })
    .click()
  await expect(
    page.getByText("Conversation unavailable for this account.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/request-inbox$/)
  state.conversationError = false
  await page
    .getByRole("button", {
      name: "Go to chat for request booking-1",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/messages\?request=booking-1$/)
})
async function mockInbox(
  page: Page,
  role: Account["role"] = "STAFF",
  isHead = true,
) {
  const state = {
    requests: Array.from({ length: 11 }, (_, index) => fixture(index + 1)),
    accepts: 0,
    mutations: [] as string[],
    mutationError: 404,
    inboxReads: 0,
    listError: false,
    detailsError: false,
    acceptError: 0,
    releaseAccept: null as (() => void) | null,
    pauseAccept: false,
    queries: [] as string[],
    conversationError: false,
  }
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.headers().authorization).toBe("Bearer test-session")
    if (url.pathname.startsWith("/api/request-conversations/")) {
      if (state.conversationError)
        return route.fulfill({
          status: 403,
          json: { error: "Conversation unavailable for this account." },
        })
      if (url.pathname.endsWith("/events"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: "event: connected\ndata: {}\n\n",
        })
      return route.fulfill({
        json: {
          conversation: {
            department: { id: "design", name: "Design" },
            head: { id: "head-1", fullName: "Dani Head" },
          },
          canSend: true,
          messages: [],
          nextCursor: null,
        },
      })
    }
    if (url.pathname === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "head-1",
            email: "head@example.com",
            fullName: "Dani Head",
            contactNumber: null,
            role,
            isActive: true,
            permissions: ["dashboard:read", "profile:read"],
            createdAt: "2026-01-01T00:00:00Z",
            headOf: isHead ? { id: "design", name: "Design" } : null,
          } satisfies Account,
        },
      })
    if (url.pathname === "/api/request-inbox") {
      state.inboxReads++
      state.queries.push(url.search)
      if (state.listError)
        return route.fulfill({
          status: 503,
          json: { error: "Inbox temporarily unavailable." },
        })
      const view = url.searchParams.get("view")
      const search = (url.searchParams.get("search") ?? "").toLowerCase()
      const currentPage = Number(url.searchParams.get("page") ?? "1")
      const filtered = state.requests.filter(
        (item) =>
          (view === "all" ||
            item.status ===
              {
                pending: "SUBMITTED",
                "under-review": "UNDER_REVIEW",
                "awaiting-information": "AWAITING_CLIENT_INFO",
                "ready-for-quotation": "READY_FOR_QUOTATION",
                closed: "CLOSED",
                cancelled: "CANCELLED",
              }[view || "pending"]) &&
          `${item.id} ${item.referenceNumber ?? ""} ${item.client.fullName} ${item.service.name}`
            .toLowerCase()
            .includes(search),
      )
      const sortBy = url.searchParams.get("sortBy")
      const sign = url.searchParams.get("sortDir") === "desc" ? -1 : 1
      if (sortBy === "reference" || sortBy === "service")
        filtered.sort((a, b) => {
          if (
            sortBy === "reference" &&
            (!a.referenceNumber || !b.referenceNumber)
          )
            return !a.referenceNumber ? 1 : -1
          const left =
            sortBy === "reference" ? a.referenceNumber! : a.service.name
          const right =
            sortBy === "reference" ? b.referenceNumber! : b.service.name
          return left.localeCompare(right) * sign || a.id.localeCompare(b.id)
        })
      return route.fulfill({
        json: {
          department: { id: "design", name: "Design" },
          serviceRequests: filtered.slice(
            (currentPage - 1) * 10,
            currentPage * 10,
          ),
          total: filtered.length,
          page: currentPage,
          pageSize: 10,
        },
      })
    }
    const match = url.pathname.match(
      /^\/api\/request-inbox\/(booking-\d+)(\/accept|\/decline)?$/,
    )
    if (match) {
      const item = state.requests.find((item) => item.id === match[1])!
      if (match[2] === "/decline" || request.method() === "DELETE") {
        const declining = match[2] === "/decline"
        expect(request.method()).toBe(declining ? "POST" : "DELETE")
        state.mutations.push(`${request.method()} ${url.pathname}`)
        // These UI endpoints are not implemented by the current API. Exercise
        // failure recovery without inventing a successful server contract.
        return route.fulfill({
          status: state.mutationError,
          json: { error: "Please retry." },
        })
      }
      if (match[2] === "/accept") {
        expect(request.method()).toBe("POST")
        state.accepts++
        if (state.pauseAccept)
          await new Promise<void>((resolve) => {
            state.releaseAccept = resolve
          })
        if (state.acceptError) {
          if (state.acceptError === 409) {
            item.status = "UNDER_REVIEW"
            item.acceptedDepartmentId = "other-department"
          }
          return route.fulfill({
            status: state.acceptError,
            json: {
              error:
                state.acceptError === 409
                  ? "This request is no longer awaiting acceptance. Refresh the inbox."
                  : "Could not save acceptance. Try again.",
            },
          })
        }
        item.status = "UNDER_REVIEW"
        item.acceptedDepartmentId = "design"
        return route.fulfill({ json: { serviceRequest: item } })
      }
      if (state.detailsError)
        return route.fulfill({
          status: 503,
          json: { error: "Details temporarily unavailable." },
        })
      return route.fulfill({ json: { serviceRequest: item } })
    }
    return route.fulfill({ status: 404, json: { error: "Unexpected request" } })
  })
  return state
}
test.use({ reducedMotion: "reduce" })

for (const width of [1440, 390]) {
  test(`failed delete preserves the booking after cancellation and retry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = await mockInbox(page)
    await page.goto("/request-inbox")
    const review = page.getByRole("button", {
      name: "Review request booking-1",
      exact: true,
    })
    const label = "Delete request"
    const trigger = page.getByRole("button", {
      name: "Delete request booking-1",
      exact: true,
    })

    await trigger.click()
    const confirmation = page.getByRole("dialog", {
      name: "Delete this request?",
    })
    await expect(confirmation).toContainText("Website Development")
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click()
    expect(state.mutations).toEqual([])
    await trigger.click()
    state.mutationError = 503
    const confirm = confirmation.getByRole("button", {
      name: label,
      exact: true,
    })
    await confirm.click()
    await expect.poll(() => state.mutations.length).toBe(1)
    await expect(confirm).toBeEnabled()
    expect(state.requests[0].status).toBe("SUBMITTED")
    expect(state.requests).toHaveLength(11)
    state.mutationError = 404
    await confirm.click()
    await expect(confirmation).not.toBeVisible()
    expect(state.mutations).toEqual(
      Array(2).fill("DELETE /api/request-inbox/booking-1"),
    )
    expect(state.requests[0].status).toBe("SUBMITTED")
    expect(state.requests).toHaveLength(11)
    await page.reload()
    await expect(page.getByText("Showing 1–10 of 11")).toBeVisible()
    await expect(review).toBeVisible()
  })
}

for (const width of [1440, 390]) {
  test(`department head reviews and accepts booked services at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = await mockInbox(page)
    await page.goto("/request-inbox")
    await expect(
      page.getByRole("heading", { name: "Request Inbox", exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Showing 1–10 of 11")).toBeVisible()
    await expect(
      page.getByRole("table", { name: "Department requests" }),
    ).toBeVisible()
    await expect(page.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
    if (width === 390)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    await expect(
      page.getByRole("link", { name: "Request Inbox", exact: true }),
    ).toHaveAttribute("aria-current", "page")
    if (width === 390)
      await page
        .getByRole("complementary", { name: "Primary navigation" })
        .getByRole("button", { name: "Close navigation menu" })
        .click()
    await page.screenshot({
      path: `test-results/request-inbox-${width}.png`,
      fullPage: true,
    })
    await page.getByRole("button", { name: "Page 2", exact: true }).click()
    await expect(page.getByText("Showing 11–11 of 11")).toBeVisible()
    await expect(page.getByText("booking-11", { exact: true })).toBeVisible()
    await page
      .getByRole("searchbox", { name: "Search requests" })
      .fill("sr-inbox-2")
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
    await expect(page.getByText("SR-INBOX-2", { exact: true })).toHaveCount(1)
    await expect(page.getByText("SR-INBOX-2", { exact: true })).toBeVisible()
    await page
      .getByRole("searchbox", { name: "Search requests" })
      .fill("Mara Client 1")
    await expect(page.getByText("Showing 1–3 of 3")).toBeVisible()
    await page
      .getByRole("button", { name: "Review request booking-1", exact: true })
      .click()
    const drawer = page.getByRole("dialog", { name: "Booking details" })
    await expect(drawer.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
    await expect(
      drawer.getByText("client1@example.com", { exact: true }),
    ).toBeVisible()
    await expect(
      drawer.getByText("Five accessible pages and a contact form."),
    ).toBeVisible()
    await expect(drawer.getByText("Reach more customers.")).toBeVisible()
    await page.screenshot({
      path: `test-results/request-inbox-details-${width}.png`,
      fullPage: true,
    })
    state.pauseAccept = true
    await drawer
      .getByRole("button", { name: "Accept request", exact: true })
      .click()
    await expect(
      drawer.getByRole("button", { name: "Accepting…" }),
    ).toBeDisabled()
    await expect(
      drawer.getByRole("button", { name: "Close booking details" }),
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeVisible()
    await expect.poll(() => state.accepts).toBe(1)
    state.releaseAccept!()
    await expect(
      drawer.getByRole("link", { name: "Open request workspace", exact: true }),
    ).toBeVisible()
    await expect(drawer.getByLabel("Message", { exact: true })).toHaveCount(0)
    await expect(drawer.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
    await drawer.getByRole("button", { name: "Close booking details" }).click()
    await expect(drawer).not.toBeVisible()
    await expect(
      page.getByRole("button", {
        name: "Review request booking-1",
        exact: true,
      }),
    ).not.toBeVisible()
    await page.getByRole("combobox", { name: "Filter requests" }).click()
    await page
      .getByRole("option", { name: "Under review", exact: true })
      .click()
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
    await page
      .getByRole("button", { name: "Review request booking-1", exact: true })
      .click()
    await expect(drawer).toBeVisible()
    await drawer
      .getByRole("button", { name: "Go to chat", exact: true })
      .click()
    await expect(page).toHaveURL(/\/messages\?request=booking-1$/)
    await expect(
      page.getByRole("region", { name: "Request conversation" }),
    ).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.goto("/request-inbox")
    await page
      .getByRole("searchbox", { name: "Search requests" })
      .fill("nothing matches")
    await expect(page.getByText("No requests match this view.")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test("head can retry failures and a concurrent acceptance refreshes stale details", async ({
  page,
}) => {
  const state = await mockInbox(page)
  state.listError = true
  await page.goto("/request-inbox")
  await expect(page.getByText("Inbox temporarily unavailable.")).toBeVisible()
  state.listError = false
  await page.getByRole("button", { name: "Try again" }).click()
  state.detailsError = true
  await page
    .getByRole("button", { name: "Review request booking-1", exact: true })
    .click()
  await expect(page.getByText("Details temporarily unavailable.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Accept request", exact: true }),
  ).toHaveCount(0)
  state.detailsError = false
  await page.getByRole("button", { name: "Try again" }).click()
  state.acceptError = 503
  await page
    .getByRole("button", { name: "Accept request", exact: true })
    .click()
  const drawer = page.getByRole("dialog", { name: "Booking details" })
  await expect(drawer.getByRole("alert")).toHaveText(
    "Could not save acceptance. Try again.",
  )
  await expect(
    drawer.getByRole("button", { name: "Accept request", exact: true }),
  ).toBeEnabled()
  state.acceptError = 409
  await drawer
    .getByRole("button", { name: "Accept request", exact: true })
    .click()
  await expect(
    drawer.getByText(
      "Another department accepted this request. Its conversation is private to that department and the client.",
      {
        exact: true,
      },
    ),
  ).toBeVisible()
  await expect(
    drawer.getByRole("button", { name: "Accept request", exact: true }),
  ).toHaveCount(0)
  expect(state.accepts).toBe(2)
})

for (const scenario of [
  { role: "STAFF", head: false },
  { role: "ADMIN", head: true },
  { role: "SUPERADMIN", head: true },
  { role: "USER", head: true },
] as const) {
  test(`${scenario.role} with head=${scenario.head} cannot open the head-only inbox`, async ({
    page,
  }) => {
    const state = await mockInbox(page, scenario.role, scenario.head)
    await page.goto("/request-inbox")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("link", { name: "Request Inbox", exact: true }),
    ).toHaveCount(0)
    expect(state.inboxReads).toBe(0)
  })
}
