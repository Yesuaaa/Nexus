import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("loads scoped dashboard records and isolates a failed section", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  const future = new Date(Date.now() + 86_400_000).toISOString()
  const later = new Date(Date.now() + 172_800_000).toISOString()
  const notifications = [
    {
      id: "1",
      requestId: "quote",
      type: "QUOTATION_SENT",
      entityId: "quote-1",
      summary: "Quotation available",
      createdAt: future,
      readAt: null,
    },
    {
      id: "2",
      requestId: "internal",
      type: "QUOTATION_SENT",
      summary: "Old quotation update",
      createdAt: future,
      readAt: null,
    },
    {
      id: "3",
      requestId: "internal",
      type: "QUOTATION_INTERNAL_REVIEW",
      summary: "Internal operation",
      createdAt: future,
      readAt: null,
    },
  ]
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({ json: { notifications, unreadCount: 0 } }),
  )
  let outstanding = [
    {
      id: "requirement-1",
      requestId: "missing",
      reference: "REQ-43",
      service: "Service design",
      title: "Provide the requested information",
      reason: "Send your brief.",
    },
    {
      id: "quotation:quote-1",
      requestId: "quote",
      reference: "REQ-42",
      service: "Client quotation",
      title: "Review your quotation",
      reason: "Make a decision.",
      deadline: later,
    },
  ]
  await page.route("**/api/request-workflows/outstanding-actions?*", (route) =>
    route.fulfill({
      json: {
        actions: outstanding,
        total: outstanding.length,
        page: 1,
        pageSize: 10,
      },
    }),
  )

  await page.route("**/api/projects/calendar", (route) =>
    route.fulfill({
      json: [
        {
          type: "meeting",
          title: "Pending meeting",
          startsAt: future,
          pending: true,
        },
        {
          type: "consultation",
          title: "Past appointment",
          startsAt: "2020-01-01T06:00:00Z",
        },
        { type: "milestone", title: "Future milestone", startsAt: future },
        { type: "meeting", title: "Later meeting", startsAt: later },
        {
          type: "consultation",
          title: "Next confirmed appointment",
          startsAt: future,
          location: "Online",
        },
      ],
    }),
  )
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      json: [
        {
          id: "owned-project",
          name: "Client project",
          status: "IN_PROGRESS",
          taskCount: 4,
          completedTasks: 3,
        },
        {
          id: "archived-project",
          name: "Completed project",
          status: "COMPLETED",
          taskCount: 2,
          completedTasks: 2,
        },
      ],
    }),
  )
  let failBooked = true
  await page.route("**/api/client/service-requests?*", (route) => {
    const isMissing = new URL(route.request().url()).searchParams.has("status")
    if (failBooked && !isMissing) {
      return route.fulfill({
        status: 503,
        json: { error: "Service unavailable" },
      })
    }
    return route.fulfill({
      json: {
        requests: [
          {
            id: isMissing ? "missing" : "booked",
            referenceNumber: isMissing ? "REQ-43" : "REQ-44",
            title: "Booked client service",
            service: { name: "Service design" },
            status: isMissing ? "AWAITING_CLIENT_INFO" : "ACTIVATED",
            createdAt: future,
          },
        ],
      },
    })
  })
  await page.goto("/dashboard")
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  await expect(
    dashboard.getByRole("link", { name: "Client project" }),
  ).toHaveAttribute("href", "/projects/owned-project")
  await expect(
    dashboard.getByRole("progressbar", { name: "Client project progress" }),
  ).toHaveAttribute("aria-valuenow", "75")
  await expect(dashboard.getByText("Next confirmed appointment")).toBeVisible()
  await dashboard.getByRole("button", { name: "Review Now" }).click()
  await expect(
    dashboard.getByText("Provide the requested information"),
  ).toBeVisible()
  await expect(dashboard.getByText("Review your quotation")).toBeVisible()
  await expect(dashboard.getByText("Internal quotation")).toHaveCount(0)
  await expect(dashboard.getByText("Internal operation")).toHaveCount(0)
  await expect(dashboard.getByText("Quotation available")).toHaveCount(0)
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await expect(
    page.getByRole("menuitem", { name: /Quotation available/ }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dashboard.getByText("Preview · Sample data")).toHaveCount(0)
  const booked = dashboard.getByRole("region", { name: "Booked Requests" })
  await expect(booked.getByRole("alert")).toBeVisible()
  failBooked = false
  await booked.getByRole("button", { name: "Try again" }).click()
  await expect(booked.getByText("Activated")).toBeVisible()
  outstanding = []
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(
    dashboard.getByText("No pending actions", { exact: true }),
  ).toBeVisible()
})

test("keeps explicitly selected preview fixtures separate", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let projectReads = 0
  await page.route("**/api/projects", (route) => {
    projectReads++
    return route.fulfill({ json: [] })
  })
  await page.goto("/dashboard?preview=loaded")
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  await expect(dashboard.getByText("Preview · Sample data")).toBeVisible()
  await expect(
    dashboard.getByRole("heading", { name: "Harbor & Pine website refresh" }),
  ).toBeVisible()
  expect(projectReads).toBe(0)
})

test("keeps duplicate event text separate from outstanding actions", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  const notification = {
    requestId: "held",
    type: "REQUIREMENT_REQUESTED",
    entityId: "requirement",
    summary: "Information requested",
    readAt: null,
  }
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({
      json: {
        unreadCount: 2,
        notifications: [
          {
            ...notification,
            id: "notice-2",
            createdAt: "2026-11-21T08:00:00Z",
          },
          {
            ...notification,
            id: "notice-1",
            createdAt: "2026-11-20T08:00:00Z",
          },
        ],
      },
    }),
  )
  await page.goto("/dashboard")
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  await expect(dashboard.getByText("No pending actions")).toBeVisible()
  await expect(dashboard.getByText("Send a brief")).toHaveCount(0)
  await expect(
    dashboard
      .getByRole("region", { name: "From Your Team" })
      .getByText("Information requested", { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Notifications, 2 unread" }).click()
  await expect(
    page.getByRole("menuitem", { name: /Information requested/ }),
  ).toHaveCount(2)
})

test("expands the compact action list and reaches later pages", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  await page.route(
    "**/api/request-workflows/outstanding-actions?*",
    (route) => {
      const currentPage = Number(
        new URL(route.request().url()).searchParams.get("page"),
      )
      const actions = (
        currentPage === 1
          ? ["First requirement", "Second requirement", "Third requirement"]
          : ["Later payment"]
      ).map((title) => ({
        id: title,
        requestId: "request",
        reference: "REQ-01",
        service: "Client service",
        title,
        reason: "Needs attention.",
      }))
      return route.fulfill({
        json: { actions, total: 4, page: currentPage, pageSize: 3 },
      })
    },
  )
  await page.goto("/dashboard")
  const panel = page.getByRole("region", { name: "Needs Your Input" })
  await expect(panel.getByText("4 actions")).toBeVisible()
  await expect(panel.getByText("Third requirement")).toHaveCount(0)
  await panel.getByRole("button", { name: "Review Now" }).click()
  await panel.getByRole("button", { name: "Show all actions" }).click()
  await expect(panel.getByText("Third requirement")).toBeVisible()
  await panel.getByRole("button", { name: "Next page" }).click()
  await expect(panel.getByText("Later payment")).toBeVisible()
  await panel.getByRole("button", { name: "Show fewer actions" }).click()
  await expect(panel.getByText("First requirement")).toBeVisible()
  await expect(panel.getByText("Third requirement")).toHaveCount(0)
})
