import { expect, test, type Page } from "@playwright/test"
import { join } from "node:path"
import { configureRegressionTest, restoreSession } from "../regression-support"

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
  id: "action-" + index,
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
  {
    path: "/api/request-workflows/notifications",
    region: "Recent Updates",
    emptyText: "No recent updates",
    empty: { notifications: [], unreadCount: 0 },
    populated: {
      unreadCount: 1,
      notifications: [
        {
          id: "notice-1",
          requestId: "req-1",
          type: "CONSULTATION_SCHEDULED",
          summary: long,
          createdAt: date,
        },
        {
          id: "notice-2",
          requestId: "req-2",
          type: "PROJECT_ACTIVATED",
          summary: "Your project is ready",
          createdAt: date,
        },
        {
          id: "notice-3",
          requestId: "req-2",
          type: "DELIVERABLE_CLIENT_REVIEWED",
          summary: "Review received",
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
  await expect(panel.getByText("5 actions", { exact: true })).toBeVisible()
  const viewports = [
    [1536, 850, "desktop"],
    [1366, 850, "laptop"],
    [1024, 1100, "tablet-landscape"],
    [820, 1700, "tablet-portrait"],
    [768, 1300, "small-tablet"],
    [390, 844, "mobile"],
  ] as const
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height })
    expect(
      await dashboard
        .locator("section")
        .evaluateAll((nodes) =>
          nodes.every((node) => node.scrollWidth <= node.clientWidth + 1),
        ),
    ).toBe(true)
    const projects = dashboard.getByRole("region", { name: "Active Projects" })
    const projectBox = await projects.boundingBox()
    const actionBox = await panel.boundingBox()
    expect(projectBox).not.toBeNull()
    expect(actionBox).not.toBeNull()
    if (width >= 1024) expect(actionBox!.x).toBeGreaterThan(projectBox!.x)
    else expect(actionBox!.y).toBeGreaterThan(projectBox!.y)
  }
  await page.setViewportSize({ width: 1536, height: 1350 })
  const services = dashboard.getByRole("link", { name: "Explore Services" })
  await services.focus()
  await page.keyboard.press("Tab")
  await expect(
    dashboard.getByRole("link", { name: "View Calendar" }),
  ).toBeFocused()
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
    panel.getByRole("link", { name: "Find in Booked Requests" }).first(),
  ).toHaveAttribute("href", "/service-requests")
  if (process.env.NEXUS_DASHBOARD_SCREENSHOTS) {
    stress = false
    await page.reload()
    await expect(panel.getByText("5 actions", { exact: true })).toBeVisible()
    await expect(
      dashboard.getByText("Your project is ready", { exact: true }),
    ).toBeVisible()
    for (const [width, height, name] of viewports) {
      await page.setViewportSize({ width, height })
      await capture(page, name)
    }
    await page.setViewportSize({ width: 1536, height: 1120 })
    await panel.getByRole("button", { name: "Show all actions" }).click()
    await capture(page, "multiple-actions")
  }
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
    await expect(
      dashboard.getByText("Loading section…", { exact: true }),
    ).toHaveCount(4)
    await expect(
      dashboard.getByText("Loading appointment…", { exact: true }),
    ).toHaveCount(1)
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
      dashboard.getByText("Your project is ready", { exact: true }),
    ).toBeVisible()
    await capture(page, name)
  }
  for (const resource of resources) modes.set(resource.path, "error")
  await page.reload()
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
    dashboard.getByText("Your project is ready", { exact: true }),
  ).toBeVisible()
})
