import { expect, test, type Page } from "@playwright/test"
import { join } from "node:path"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

const long =
  "Client portal accessibility and reporting modernization " +
  "LongIdentifier".repeat(14)
const date = new Date(Date.now() + 86_400_000).toISOString()
const actions = [
  "Provide the requested information",
  "Review your quotation",
  "Sign your agreement",
  "Complete your payment",
  "Review your deliverable",
].map((title, index) => ({
  id:
    index === 1
      ? "quotation:quote-1"
      : index === 3
        ? "payment:payment-1"
        : "action-" + index,
  requestId: "req-1",
  service: long,
  reference: "REQ-" + "128".repeat(12),
  title,
  reason: index === 0 ? long : "Complete this step to continue.",
  ...(index === 1 ? { deadline: date } : {}),
  ...(index === 4
    ? { destination: "/projects/project-1/deliverables/milestone-1" }
    : {}),
}))
const resources = [
  {
    path: "/api/projects/calendar",
    region: "Next Up",
    emptyText: "No upcoming appointments",
    empty: [],
    populated: [
      {
        id: "event",
        type: "consultation",
        title: "Website consultation",
        context: long,
        location: "Video conference",
        startsAt: date,
      },
    ],
  },
  {
    path: "/api/projects",
    region: "Active Projects",
    emptyText: "No active projects",
    empty: [],
    populated: [
      {
        id: "project-1",
        name: long,
        status: "IN_PROGRESS",
        completedTasks: 800,
        taskCount: 1200,
      },
      {
        id: "project-2",
        name: "Campaign launch",
        status: "ON_HOLD",
        completedTasks: 0,
        taskCount: 0,
      },
      {
        id: "project-3",
        name: "Additional project",
        status: "IN_PROGRESS",
        completedTasks: 1,
        taskCount: 3,
      },
    ],
  },
  {
    path: "/api/request-workflows/outstanding-actions",
    region: "Needs Your Input",
    emptyText: "No pending actions",
    empty: { actions: [], total: 0, page: 1, pageSize: 10 },
    populated: { actions, total: actions.length, page: 1, pageSize: 10 },
  },
  {
    path: "/api/client/service-requests",
    region: "Booked Requests",
    emptyText: "No booked requests",
    empty: { requests: [] },
    populated: {
      requests: [
        {
          id: "req-1",
          title: long,
          referenceNumber: "REQ-" + "349".repeat(12),
          service: { name: "Design" },
          preferredSpecialistName: "Maria Santos",
          status: "ACTIVATED",
          createdAt: date,
        },
        {
          id: "req-2",
          title: "Search Engine Optimization",
          referenceNumber: null,
          service: { name: "SEO" },
          status: "SUBMITTED",
          createdAt: date,
        },
      ],
    },
  },
] as const

type Mode = "loaded" | "empty" | "error" | "pending"
async function mockDashboard(
  page: Page,
  modes: Map<string, Mode>,
  gate?: Promise<void>,
  stress: () => boolean = () => false,
) {
  await restoreSession(page, "USER")
  for (const resource of resources) {
    await page.route(
      (url) => url.pathname === resource.path,
      async (route) => {
        const mode = modes.get(resource.path) ?? "loaded"
        if (mode === "pending") await gate
        if (mode === "error")
          return route.fulfill({
            status: 503,
            json: { error: "Temporarily unavailable" },
          })
        return route.fulfill({
          json:
            mode === "empty"
              ? resource.empty
              : stress()
                ? resource.populated
                : JSON.parse(
                    JSON.stringify(resource.populated)
                      .replaceAll(
                        long,
                        "Client portal refresh and launch readiness",
                      )
                      .replaceAll("128".repeat(12), "1048")
                      .replaceAll("349".repeat(12), "1065"),
                  ),
        })
      },
    )
  }
}

async function capture(page: Page, name: string) {
  const directory = process.env.NEXUS_DASHBOARD_SCREENSHOTS
  if (directory)
    await page.screenshot({
      path: join(directory, "converyn-phase5-" + name + ".png"),
      style: "nextjs-portal{display:none!important}",
      animations: "disabled",
    })
}

test("long dashboard records fit approved widths and the action list stays keyboard usable", async ({
  page,
}) => {
  let stress = true
  await mockDashboard(page, new Map(), undefined, () => stress)
  await page.goto("/dashboard")
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  const panel = dashboard.getByRole("region", { name: "Needs Your Input" })
  const booked = dashboard.getByRole("region", { name: "Booked Requests" })
  await expect(
    dashboard.getByRole("link", { name: "New Request", exact: true }),
  ).toHaveAttribute("href", "/services")
  await expect(panel.getByText("5 actions", { exact: true })).toBeVisible()
  await expect(
    panel.getByText("Review your quotation", { exact: true }),
  ).toBeVisible()
  await expect(
    dashboard.getByText("0 of 0 tasks", { exact: true }),
  ).toHaveCount(0)
  await expect(booked.getByText(/REQ-349/)).toHaveCount(0)
  const viewports = [
    [1536, 850, "desktop"],
    [1366, 850, "laptop"],
    [1024, 1100, "tablet-landscape"],
    [820, 1700, "tablet-portrait"],
    [768, 1300, "small-tablet"],
    [390, 844, "mobile"],
  ] as const
  for (const [width, height, name] of viewports) {
    await page.setViewportSize({ width, height })
    expect(
      await dashboard
        .locator("section")
        .evaluateAll((nodes) =>
          nodes.every((node) => node.scrollWidth <= node.clientWidth + 1),
        ),
    ).toBe(true)
    const projects = dashboard.getByRole("region", { name: "Active Projects" })
    const previews = projects.locator(":scope > ul > li")
    const projectBox = await projects.boundingBox()
    const actionBox = await panel.boundingBox()
    expect(projectBox).not.toBeNull()
    expect(actionBox).not.toBeNull()
    const bookedBox = (await booked.boundingBox())!
    const nextUpBox = (await dashboard
      .getByRole("region", { name: "Next Up" })
      .boundingBox())!
    if (name === "desktop") {
      await expect(previews).toHaveCount(2)
      await expect(
        projects.getByText("3 projects · 1 on hold", { exact: true }),
      ).toBeVisible()
      await expect(
        projects.getByRole("link", { name: "View all projects" }),
      ).toHaveAttribute("href", "/projects")
      const first = (await previews.nth(0).boundingBox())!
      const second = (await previews.nth(1).boundingBox())!
      expect(second.x).toBe(first.x)
      expect(second.y).toBeGreaterThan(first.y)
      expect(actionBox!.x).toBeGreaterThan(nextUpBox.x)
      expect(projectBox!.y).toBeGreaterThanOrEqual(
        nextUpBox.y + nextUpBox.height,
      )
      expect(bookedBox.x).toBeGreaterThan(projectBox!.x)
      expect(bookedBox.y).toBeGreaterThanOrEqual(
        actionBox!.y + actionBox!.height,
      )
    } else if (name === "mobile") {
      const first = (await previews.nth(0).boundingBox())!
      const second = (await previews.nth(1).boundingBox())!
      expect(second.x).toBe(first.x)
      expect(second.y).toBeGreaterThan(first.y)
      expect(actionBox!.y).toBeLessThan(nextUpBox.y)
      expect(nextUpBox.y).toBeLessThan(projectBox!.y)
      expect(projectBox!.y).toBeLessThan(bookedBox.y)
    }
  }
  await page.setViewportSize({ width: 1536, height: 1350 })
  const services = dashboard.getByRole("link", { name: "Explore Services" })
  await services.focus()
  const review = dashboard.getByRole("button", { name: "Review Now" })
  for (
    let i = 0;
    i < 8 &&
    !(await review.evaluate((node) => node === document.activeElement));
    i += 1
  ) {
    await page.keyboard.press("Tab")
  }
  await expect(review).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(dashboard.locator("#dashboard-client-action-list")).toBeFocused()
  await dashboard.getByRole("link", { name: "View Calendar" }).focus()
  const calendarLink = dashboard.getByRole("link", { name: "View Calendar" })
  expect(
    await calendarLink.evaluate((node) => {
      const style = getComputedStyle(node)
      return (
        node.matches(":focus-visible") &&
        (style.outlineStyle !== "none" || style.boxShadow !== "none")
      )
    }),
  ).toBe(true)
  for (const text of [
    "Next Up",
    "Provide the requested information",
    "Activated",
    "Pending",
    "Video conference",
  ]) {
    const item = dashboard.getByText(text, { exact: true }).first()
    const ratio = await item.evaluate((node) => {
      const ctx = document.createElement("canvas").getContext("2d")!
      const layers: string[] = []
      for (
        let element: Element | null = node;
        element;
        element = element.parentElement
      )
        layers.unshift(getComputedStyle(element).backgroundColor)
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, 1, 1)
      for (const layer of layers) {
        ctx.fillStyle = layer
        ctx.fillRect(0, 0, 1, 1)
      }
      function luminance(rgb: Uint8ClampedArray) {
        const values = Array.from(rgb.slice(0, 3), (value) => {
          const v = value / 255
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
      }
      const background = luminance(ctx.getImageData(0, 0, 1, 1).data)
      ctx.fillStyle = getComputedStyle(node).color
      ctx.fillRect(0, 0, 1, 1)
      const foreground = luminance(ctx.getImageData(0, 0, 1, 1).data)
      return (
        (Math.max(background, foreground) + 0.05) /
        (Math.min(background, foreground) + 0.05)
      )
    })
    expect(ratio, text).toBeGreaterThanOrEqual(4.5)
  }
  await expect(dashboard.getByRole("progressbar").first()).toHaveAttribute(
    "aria-valuenow",
    "67",
  )
  const showAll = panel.getByRole("button", { name: "Show all actions" })
  await showAll.focus()
  await page.keyboard.press("Enter")
  await expect(showAll).toHaveCount(0)
  await expect(
    panel.getByRole("button", { name: "Show fewer actions" }),
  ).toHaveAttribute("aria-expanded", "true")
  await expect(
    panel.getByRole("link", { name: "Open deliverable" }),
  ).toHaveAttribute("href", "/projects/project-1/deliverables/milestone-1")
  await expect(
    panel.getByRole("link", { name: "View request" }).first(),
  ).toHaveAttribute("href", "/service-requests")
  await expect(
    panel.getByRole("link", { name: "View quote request" }),
  ).toHaveAttribute("href", "/service-requests")
  await expect(
    panel.getByRole("link", { name: "View payment request" }),
  ).toHaveAttribute("href", "/service-requests")
  await expect(panel.getByText(/REQ-128/)).toHaveCount(0)
  if (process.env.NEXUS_DASHBOARD_SCREENSHOTS) {
    stress = false
    await page.route("**/api/project-conversations?*", (route) =>
      route.fulfill({
        json: {
          unreadCount: 1,
          nextCursor: null,
          conversations: [
            {
              id: "project-chat",
              name: "Website project",
              updatedAt: date,
              unreadCount: 1,
              lastMessage: {
                id: "msg",
                body: "The project plan is ready for you.",
                createdAt: date,
                sender: { id: "staff", fullName: "Maria Santos" },
              },
            },
          ],
        },
      }),
    )
    await page.reload()
    await expect(
      dashboard
        .getByRole("region", { name: "From Your Team" })
        .getByText("The project plan is ready for you.", { exact: true }),
    ).toBeVisible()
    await expect(panel.getByText("5 actions", { exact: true })).toBeVisible()
    await expect(
      dashboard
        .getByRole("region", { name: "Booked Requests" })
        .getByText("Activated", { exact: true }),
    ).toBeVisible()
    for (const [width, height, name] of viewports) {
      await page.setViewportSize({
        width,
        height: name === "desktop" ? 1050 : height,
      })
      await capture(page, name)
    }
    await page.setViewportSize({ width: 1536, height: 1120 })
    await panel.getByRole("button", { name: "Review Now" }).click()
    await panel.getByRole("button", { name: "Show all actions" }).click()
    await capture(page, "multiple-actions")
  }
})

test("similar bookings and distinct quotation events retain context", async ({
  page,
}) => {
  await mockDashboard(page, new Map())
  await page.route("**/api/client/service-requests?*", (route) =>
    route.fulfill({
      json: {
        requests: ["REQ-40", "REQ-41", "REQ-42"].map((ref, i) => ({
          id: "booking-" + i,
          title: "Website design",
          referenceNumber: ref,
          service: { id: "design", name: "Website design" },
          projectGoals: "Booking goal " + ref,
          updatedAt: "2026-11-23T03:00:00Z",
          createdAt: i === 0 ? "2026-11-22T03:00:00Z" : "2026-11-23T03:00:00Z",
          status: "SUBMITTED",
        })),
        total: 3,
        page: 1,
        pageSize: 10,
        summary: {
          total: 3,
          pending: 3,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
        },
      },
    }),
  )
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({
      json: {
        unreadCount: 2,
        notifications: [0, 1].map((i) => ({
          id: "notice-" + i,
          requestId: "booking-" + i,
          entityId: "quotation-" + i,
          type: "QUOTATION_SENT",
          summary: "Quotation v2 is ready for the client's formal decision.",
          createdAt: "2026-11-23T0" + (3 + i) + ":00:00Z",
        })),
      },
    }),
  )
  await page.goto("/dashboard")
  const booked = page.getByRole("region", { name: "Booked Requests" })
  await expect(booked.getByText("REQ-41", { exact: true })).toBeVisible()
  await expect(booked.getByText("REQ-42", { exact: true })).toBeVisible()
  await expect(booked.getByRole("listitem")).toHaveCount(2)
  const last = page.getByRole("region", { name: "Your Last Booked Service" })
  await expect(last.getByText("Website design", { exact: true })).toBeVisible()
  await expect(last.getByText("Pending", { exact: true })).toBeVisible()
  await expect(last.locator("time")).toHaveAttribute(
    "datetime",
    "2026-11-23T03:00:00Z",
  )
  await expect(last.getByRole("link", { name: "Book Again" })).toHaveAttribute(
    "href",
    "/services?service=design",
  )
  await expect(
    page.getByRole("region", { name: "Latest from EXP" }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await expect(
    page.getByRole("menuitem", { name: /Quotation v2 is ready/ }),
  ).toHaveCount(2)
  await page.keyboard.press("Escape")
})

test("team message previews share unread counts and keep sender attribution", async ({
  page,
}) => {
  await mockDashboard(page, new Map())
  const client = accountFor("USER")
  let serviceReads = 0
  let projectReads = 0
  let writes = 0
  await page.route("**/api/request-conversations**", (route) => {
    if (route.request().method() !== "GET") {
      writes++
      return route.fulfill({ json: {} })
    }
    serviceReads++
    return route.fulfill({
      json: {
        nextCursor: null,
        unreadCount: 1,
        conversations: [
          {
            id: "booking-chat",
            client: { id: client.id },
            title: "Service conversation",
            service: { name: "Design" },
            acceptedDepartment: {
              head: { id: "head", fullName: "Maria Santos" },
              name: "Design",
            },
            lastMessage: {
              id: "mine",
              sender: { id: client.id, fullName: client.fullName },
              body: long,
              createdAt: "2026-11-23T02:00:00Z",
            },
            lastTeamMessage: {
              id: "team-note",
              sender: { id: "head", fullName: "Maria Santos" },
              body: "Your team has shared a proposal",
              createdAt: "2026-11-23T00:30:00Z",
            },
            unreadCount: 1,
          },
        ],
      },
    })
  })
  await page.route("**/api/project-conversations**", (route) => {
    if (route.request().method() !== "GET") {
      writes++
      return route.fulfill({ json: {} })
    }
    projectReads++
    return route.fulfill({
      json: {
        nextCursor: null,
        unreadCount: 1,
        conversations: [
          {
            id: "project-chat",
            name: "Website project",
            lastMessage: {
              id: "attachment",
              sender: { id: "head", fullName: "Maria Santos" },
              body: null,
              deliverable: { fileName: "plan.pdf" },
              createdAt: "2026-11-23T01:00:00Z",
            },
            unreadCount: 1,
          },
          {
            id: "older-chat",
            name: "Older project",
            lastMessage: {
              id: "older",
              sender: { id: "head", fullName: "Maria Santos" },
              body: "Earlier note",
              createdAt: "2026-11-23T00:00:00Z",
            },
            unreadCount: 0,
          },
        ],
      },
    })
  })
  await page.goto("/dashboard")
  const team = page.getByRole("region", { name: "From Your Team" })
  await expect(team.getByRole("link", { name: "View inbox" })).toHaveAttribute(
    "href",
    "/messages",
  )
  const previews = team.getByRole("link", { name: /Maria Santos|You:/ })
  await expect(previews).toHaveCount(2)
  await expect(previews.first()).toHaveAttribute(
    "href",
    "/messages?project=project-chat",
  )
  await expect(team.getByText("Attachment: plan.pdf")).toBeVisible()
  await expect(team.getByText(/You:/)).toHaveCount(0)
  await expect(
    team.getByRole("link", { name: /Your team has shared a proposal/ }),
  ).toHaveAttribute("href", "/messages?request=booking-chat")
  await expect(team.getByText("Earlier note")).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Messages, 2 unread" }),
  ).toBeVisible()
  expect({ serviceReads, projectReads, writes }).toEqual({
    serviceReads: 1,
    projectReads: 1,
    writes: 0,
  })
})

test("team messages retry independently", async ({ page }) => {
  await mockDashboard(page, new Map())
  let fail = true
  await page.route("**/api/project-conversations?*", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: "Unavailable" } }
        : {
            json: {
              nextCursor: null,
              unreadCount: 0,
              conversations: [
                {
                  id: "one",
                  name: "Website project",
                  unreadCount: 0,
                  lastMessage: {
                    id: "one-message",
                    sender: { id: "staff", fullName: "Maria Santos" },
                    body: "Ready for review",
                    createdAt: date,
                  },
                },
              ],
            },
          },
    ),
  )
  await page.goto("/dashboard")
  const team = page.getByRole("region", { name: "From Your Team" })
  await expect(team.getByRole("alert")).toBeVisible()
  fail = false
  await team.getByRole("button", { name: "Try again" }).click()
  await expect(team.getByRole("link", { name: /View inbox/ })).toBeVisible()
  await expect(team.getByText("Ready for review")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Messages", exact: true }),
  ).toBeVisible()
})

test("Next Up omits the hh location placeholder and retains Manila time", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-25T16:30:00Z"))
  await mockDashboard(page, new Map())
  await page.route("**/api/projects/calendar", (route) =>
    route.fulfill({
      json: [
        {
          id: "event",
          type: "consultation",
          title: "Website consultation",
          location: "hh",
          startsAt: "2026-11-26T03:36:00Z",
        },
      ],
    }),
  )
  await page.goto("/dashboard")
  const nextUp = page.getByRole("region", { name: "Next Up" })
  await expect(
    nextUp.getByText("Website consultation", { exact: true }),
  ).toBeVisible()
  await expect(nextUp.getByText("11:36 AM PHT", { exact: true })).toBeVisible()
  await expect(nextUp.getByText("hh", { exact: true })).toHaveCount(0)
})

test("dashboard ranks deadlines by Manila calendar date", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-25T16:30:00Z"))
  await mockDashboard(page, new Map())
  await page.route("**/api/request-workflows/outstanding-actions?**", (route) =>
    route.fulfill({
      json: {
        actions: [
          { ...actions[0], title: "No deadline" },
          { ...actions[1], deadline: "2026-11-26T16:00:00Z" },
          { ...actions[2], deadline: "2026-11-26T15:00:00Z" },
          { ...actions[3], deadline: "2026-11-25T15:00:00Z" },
        ],
        total: 4,
        page: 1,
        pageSize: 10,
      },
    }),
  )
  await page.goto("/dashboard")
  const panel = page.getByRole("region", { name: "Needs Your Input" })
  await panel.getByRole("button", { name: "Review Now" }).click()
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText([
    "Complete your payment",
    "Sign your agreement",
  ])
  await expect(panel.getByText("1 day overdue", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Your payment request is overdue and needs attention.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(panel.getByText("Due today", { exact: true })).toBeVisible()
  await panel.getByRole("button", { name: "Show all actions" }).click()
  await expect(panel.getByText("Due tomorrow", { exact: true })).toBeVisible()
  await expect(panel.getByRole("heading", { level: 3 }).last()).toHaveText(
    "No deadline",
  )
})

test("all sections announce loading, show empty states, and retry independently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 950 })
  const modes = new Map<string, Mode>(
    resources.map((resource) => [resource.path, "pending"]),
  )
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await mockDashboard(page, modes, gate)
  try {
    await page.goto("/dashboard")
    const dashboard = page.getByRole("main", { name: "Client dashboard" })
    await expect(dashboard.getByRole("status")).toHaveText("Loading dashboard…")
    await expect(
      dashboard.getByRole("region", { name: "Active Projects" }),
    ).toHaveCount(0)
  } finally {
    release()
  }
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  for (const resource of resources) modes.set(resource.path, "empty")
  await page.reload()
  for (const resource of resources)
    await expect(
      dashboard.getByText(resource.emptyText, { exact: true }),
    ).toBeVisible()
  await expect(
    dashboard
      .getByRole("region", { name: "From Your Team" })
      .getByText("No conversations with your team yet."),
  ).toBeVisible()
  await expect(
    dashboard.getByRole("region", { name: "Your Last Booked Service" }),
  ).toHaveCount(0)
  await capture(page, "empty-dashboard")
  for (const [index, name] of [
    [0, "no-appointment"],
    [1, "no-projects"],
    [2, "no-actions"],
  ] as const) {
    modes.clear()
    modes.set(resources[index].path, "empty")
    await page.reload()
    await expect(
      dashboard.getByText(resources[index].emptyText, { exact: true }),
    ).toBeVisible()
    await expect(
      dashboard
        .getByRole("region", { name: "Booked Requests" })
        .getByText("Activated", { exact: true }),
    ).toBeVisible()
    await capture(page, name)
  }
  for (const resource of resources) modes.set(resource.path, "error")
  await page.reload()
  await expect(
    dashboard
      .getByRole("region", { name: "Your Last Booked Service" })
      .getByRole("alert"),
  ).toBeVisible()
  for (const resource of resources)
    await expect(
      dashboard
        .getByRole("region", { name: resource.region })
        .getByRole("alert"),
    ).toBeVisible()
  for (const resource of resources) {
    modes.set(resource.path, "loaded")
    const panel = dashboard.getByRole("region", { name: resource.region })
    const retry = panel.getByRole("button", { name: "Try again" })
    await retry.focus()
    await page.keyboard.press("Enter")
    await expect(
      panel.getByRole("heading", { name: resource.region, exact: true }),
    ).toBeFocused()
    await expect(panel.getByRole("alert")).toHaveCount(0)
    if (resource.region === "Booked Requests")
      await capture(page, "section-error")
  }
  await expect(dashboard.getByText("5 actions", { exact: true })).toBeVisible()
  await expect(
    dashboard
      .getByRole("region", { name: "Booked Requests" })
      .getByText("Activated", { exact: true }),
  ).toBeVisible()
})
