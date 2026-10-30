import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import type {
  BookedService,
  BookingDetails,
} from "../src/features/bookings/api/bookings-api"

function bookingFixture(index = 1): BookingDetails {
  return {
    id: `request-${index}`,
    title: index === 1 ? "Website request" : `Service ${index} request`,
    status:
      index === 1
        ? "SUBMITTED"
        : index === 2
          ? "UNDER_REVIEW"
          : index === 3
            ? "AWAITING_CLIENT_INFO"
            : "CLOSED",
    packageName: index === 1 ? "Business Website" : null,
    expectedTimeline: "Launch within six weeks",
    preferredSpecialistName: index === 1 ? "Sam Developer" : null,
    createdAt: "2026-10-30T08:00:00.000Z",
    updatedAt: "2026-10-31T08:00:00.000Z",
    service: {
      id: `service-${index}`,
      name: index === 1 ? "Website Development" : `Service ${index}`,
    },
    projectGoals: "Reach small business owners in Manila.",
    projectRequirements: "A responsive five-page website with a contact form.",
    additionalDetails: "Please use our existing brand guide.",
  }
}

function deferred() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

type MockState = {
  role: Account["role"]
  bookings: BookingDetails[]
  listError: boolean
  detailError: boolean
  listGate: ReturnType<typeof deferred> | null
  detailGate: ReturnType<typeof deferred> | null
  listQueries: { search: string; status: string; page: number }[]
  detailIds: string[]
}

async function mockBookings(
  page: Page,
  options: Partial<
    Pick<MockState, "role" | "bookings" | "listError" | "listGate">
  > = {},
) {
  const state: MockState = {
    role: "USER",
    bookings: Array.from({ length: 11 }, (_, index) =>
      bookingFixture(index + 1),
    ),
    listError: false,
    detailError: false,
    listGate: null,
    detailGate: null,
    listQueries: [],
    detailIds: [],
    ...options,
  }
  await page.addInitScript(() => {
    sessionStorage.setItem("nexus.auth.token", "test-session")
  })
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.headers().authorization).toBe("Bearer test-session")
    if (url.pathname === "/api/auth/me") {
      const user: Account = {
        id: "client-1",
        email: "client@example.com",
        fullName: "Mara Client",
        contactNumber: null,
        role: state.role,
        isActive: true,
        permissions: ["dashboard:read", "profile:read"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }
      return route.fulfill({ json: { user } })
    }
    if (
      url.pathname === "/api/service-requests" &&
      request.method() === "GET"
    ) {
      const search = url.searchParams.get("search") ?? ""
      const status = url.searchParams.get("status") ?? ""
      const currentPage = Number(url.searchParams.get("page") ?? 1)
      state.listQueries.push({ search, status, page: currentPage })
      await state.listGate?.promise
      if (state.listError)
        return route.fulfill({
          status: 503,
          json: { error: "Booked services are temporarily unavailable." },
        })
      const filtered = state.bookings.filter(
        (booking) =>
          (!status || booking.status === status) &&
          `${booking.id} ${booking.title} ${booking.service.name} ${booking.packageName ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      const serviceRequests: BookedService[] = filtered
        .slice((currentPage - 1) * 10, currentPage * 10)
        .map((booking) => ({
          id: booking.id,
          title: booking.title,
          status: booking.status,
          packageName: booking.packageName,
          expectedTimeline: booking.expectedTimeline,
          preferredSpecialistName: booking.preferredSpecialistName,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          service: booking.service,
        }))
      return route.fulfill({
        json: {
          serviceRequests,
          total: filtered.length,
          page: currentPage,
          pageSize: 10,
        },
      })
    }
    const detailMatch = url.pathname.match(/^\/api\/service-requests\/([^/]+)$/)
    if (detailMatch && request.method() === "GET") {
      const id = decodeURIComponent(detailMatch[1])
      state.detailIds.push(id)
      await state.detailGate?.promise
      if (state.detailError)
        return route.fulfill({
          status: 503,
          json: { error: "Booking details are temporarily unavailable." },
        })
      const booking = state.bookings.find((item) => item.id === id)
      return booking
        ? route.fulfill({ json: { serviceRequest: booking } })
        : route.fulfill({ status: 404, json: { error: "Booking not found" } })
    }
    return route.fulfill({
      status: 404,
      json: { error: "Unexpected API request" },
    })
  })
  return state
}

test.use({ reducedMotion: "reduce" })

for (const width of [1440, 390]) {
  test(`clients browse, paginate and filter booked services at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const state = await mockBookings(page)
    await page.goto("/booked-services")
    const main = page.getByRole("main", {
      name: "Booked services",
      exact: true,
    })
    const table = main.getByRole("table", {
      name: "Booked services",
      exact: true,
    })
    await expect(
      main.getByRole("heading", { name: "Booked Services", exact: true }),
    ).toBeVisible()
    await expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(10)
    await expect(table.getByText("Submitted", { exact: true })).toBeVisible()
    await expect(table.getByText("Under review", { exact: true })).toBeVisible()
    await expect(
      table.getByText("Awaiting information", { exact: true }),
    ).toBeVisible()
    await expect(
      main.getByText("Showing 1–10 of 11", { exact: true }),
    ).toBeVisible()
    await expect(
      main.getByRole("link", { name: "Browse Services", exact: true }),
    ).toHaveAttribute("href", "/services")
    if (width === 390)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const navigation = page.getByRole("navigation", {
      name: "Main menu",
      exact: true,
    })
    await expect(
      navigation.getByRole("link", { name: "Booked Services", exact: true }),
    ).toHaveAttribute("aria-current", "page")
    if (width === 390)
      await page
        .getByRole("button", { name: "Close navigation menu", exact: true })
        .last()
        .click()
    await page.screenshot({
      path: `test-results/booked-services-list-${width}.png`,
      fullPage: true,
    })
    await main.getByRole("button", { name: "Next page", exact: true }).click()
    await expect(
      table.getByRole("button", {
        name: "View booking request-11",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      main.getByText("Showing 11–11 of 11", { exact: true }),
    ).toBeVisible()
    await main
      .getByRole("searchbox", { name: "Search booked services", exact: true })
      .fill("Website")
    await expect(
      table.getByRole("button", {
        name: "View booking request-1",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      main.getByText("Showing 1–1 of 1", { exact: true }),
    ).toBeVisible()
    expect(state.listQueries.at(-1)).toEqual({
      search: "Website",
      status: "",
      page: 1,
    })
    await main
      .getByRole("button", { name: "Clear filters", exact: true })
      .click()
    await expect(
      main.getByText("Showing 1–10 of 11", { exact: true }),
    ).toBeVisible()
    await main
      .getByRole("combobox", { name: "Filter bookings by status", exact: true })
      .click()
    await page
      .getByRole("option", { name: "Under review", exact: true })
      .click()
    await expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(1)
    await expect(
      table.getByRole("button", {
        name: "View booking request-2",
        exact: true,
      }),
    ).toBeVisible()
    expect(state.listQueries.at(-1)).toEqual({
      search: "",
      status: "UNDER_REVIEW",
      page: 1,
    })
    await main
      .getByRole("searchbox", { name: "Search booked services", exact: true })
      .fill("No matching service")
    await expect(table.getByRole("status")).toContainText("No results for")
    await expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(0)
    await main
      .getByRole("button", { name: "Clear filters", exact: true })
      .click()
    await expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(10)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

  test(`clients inspect booking details and return focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await mockBookings(page)
    await page.goto("/booked-services")
    const opener = page.getByRole("button", {
      name: "View booking request-1",
      exact: true,
    })
    await opener.click()
    const drawer = page.getByRole("dialog", {
      name: "Booking details",
      exact: true,
    })
    await expect(
      drawer.getByRole("heading", { name: "Website Development", exact: true }),
    ).toBeVisible()
    await expect(drawer.getByText("request-1", { exact: true })).toBeVisible()
    await expect(
      drawer.getByText("Business Website", { exact: true }),
    ).toBeVisible()
    await expect(
      drawer.getByText("Sam Developer", { exact: true }),
    ).toBeVisible()
    await expect(
      drawer.getByText("Launch within six weeks", { exact: true }),
    ).toBeVisible()
    await expect(
      drawer.getByText("Reach small business owners in Manila.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      drawer.getByText("A responsive five-page website with a contact form.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      drawer.getByText("Please use our existing brand guide.", { exact: true }),
    ).toBeVisible()
    await expect(drawer.getByText("Submitted", { exact: true })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `test-results/booked-services-details-${width}.png`,
    })
    await drawer
      .getByRole("button", { name: "Close booking details", exact: true })
      .click()
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test("a booking deep link opens details and closes back to the page", async ({
  page,
}) => {
  await mockBookings(page)
  await page.goto("/booked-services?booking=request-1")
  const drawer = page.getByRole("dialog", {
    name: "Booking details",
    exact: true,
  })
  await expect(
    drawer.getByRole("heading", { name: "Website Development", exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(drawer).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Booked Services", exact: true }),
  ).toBeVisible()
})

test("clients retry unavailable lists and booking details", async ({
  page,
}) => {
  const state = await mockBookings(page, { listError: true })
  await page.goto("/booked-services")
  const main = page.getByRole("main", { name: "Booked services", exact: true })
  await expect(main.getByRole("alert")).toContainText(
    "Booked services are temporarily unavailable.",
  )
  state.listError = false
  await main.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    main.getByRole("table").getByRole("button", { name: /^View booking / }),
  ).toHaveCount(10)
  state.detailError = true
  await main
    .getByRole("button", { name: "View booking request-1", exact: true })
    .click()
  const drawer = page.getByRole("dialog", {
    name: "Booking details",
    exact: true,
  })
  await expect(drawer.getByRole("alert")).toContainText(
    "Booking details are temporarily unavailable.",
  )
  state.detailError = false
  await drawer.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    drawer.getByRole("heading", { name: "Website Development", exact: true }),
  ).toBeVisible()
  expect(state.listQueries).toHaveLength(2)
  expect(state.detailIds).toEqual(["request-1", "request-1"])
})

test("client list and detail requests display loading states", async ({
  page,
}) => {
  const listGate = deferred()
  const detailGate = deferred()
  const state = await mockBookings(page, { listGate })
  try {
    await page.goto("/booked-services", { waitUntil: "domcontentloaded" })
    const main = page.getByRole("main", {
      name: "Booked services",
      exact: true,
    })
    await expect(main.getByRole("table").getByRole("status")).toContainText(
      "Loading booked services",
    )
    listGate.release()
    await expect(
      main.getByRole("table").getByRole("button", { name: /^View booking / }),
    ).toHaveCount(10)
    state.detailGate = detailGate
    await main
      .getByRole("button", { name: "View booking request-1", exact: true })
      .click()
    const drawer = page.getByRole("dialog", {
      name: "Booking details",
      exact: true,
    })
    await expect(drawer.getByRole("status")).toContainText(
      "Loading booking details",
    )
    detailGate.release()
    await expect(
      drawer.getByRole("heading", { name: "Website Development", exact: true }),
    ).toBeVisible()
  } finally {
    listGate.release()
    detailGate.release()
  }
})

test("internal roles cannot open client bookings or fetch their data", async ({
  page,
}) => {
  for (const role of ["ADMIN", "STAFF", "SUPERADMIN"] as const) {
    await page.unroute("**/api/**")
    const state = await mockBookings(page, { role })
    await page.goto("/booked-services?booking=request-1")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("main", { name: "Dashboard", exact: true }),
    ).toBeVisible()
    await expect(
      page
        .getByRole("navigation", { name: "Main menu", exact: true })
        .getByRole("link", { name: "Booked Services", exact: true }),
    ).toHaveCount(0)
    expect(state.listQueries).toHaveLength(0)
    expect(state.detailIds).toHaveLength(0)
  }
})
