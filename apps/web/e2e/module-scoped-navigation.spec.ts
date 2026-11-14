import { expect, test, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  accountFor,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Module navigation regressions use isolated API fixtures")

function mainMenu(page: Page) {
  return page.getByRole("navigation", { name: "Main menu", exact: true })
}

test("Client moves directly between services and projects without switching workspaces", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  await page.goto("/dashboard")
  const menu = mainMenu(page)

  await expect(menu.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(menu.getByRole("link", { name: "Calendar" })).toBeVisible()
  await expect(menu.getByRole("link", { name: "Services" })).toBeVisible()
  await expect(menu.getByRole("link", { name: "My Projects" })).toBeVisible()

  await page
    .getByRole("link", {
      name: "Services",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/services$/)
  await expect(
    menu.getByText("Service Operations", { exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Services", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    menu.getByRole("link", { name: "Booked Requests", exact: true }),
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "My Projects", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Help & Support", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("link", { name: /^Messages/ })).toBeVisible()

  await page.route("**/api/projects", (route) => route.fulfill({ json: [] }))
  await page
    .getByRole("link", {
      name: "My Projects",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(
    menu.getByText("Project Management", { exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "My Projects", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(menu.getByRole("link", { name: "Services" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Help & Support" })).toHaveCount(
    1,
  )
  await page.reload()
  await expect(menu.getByRole("link", { name: "Services" })).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Switch Workspace" }),
  ).toHaveCount(0)
})

for (const workspace of [
  {
    title: "Service Operations",
    link: "Service Management",
    hidden: "Employee Management",
  },
  {
    title: "People & HR",
    link: "Employee Management",
    hidden: "Service Management",
  },
]) {
  test(`${workspace.title} retains its shell through shared utilities and reload`, async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.route("**/api/internal-conversations/contacts", (route) =>
      route.fulfill({ json: [] }),
    )
    await page.route("**/api/projects/calendar?**", (route) =>
      route.fulfill({ json: [] }),
    )
    await page.route("**/api/auth/profile", (route) =>
      route.fulfill({
        json: { user: accountFor("ADMIN"), employee: null, specialist: null },
      }),
    )
    await page.goto("/module")
    await page
      .getByRole("link", {
        name: `Open ${workspace.title} workspace`,
        exact: true,
      })
      .click()
    const menu = mainMenu(page)

    await page.getByRole("link", { name: /^Messages/ }).click()
    await expect(page).toHaveURL(/\/messages\?mode=internal$/)
    await expect(menu.getByText(workspace.title, { exact: true })).toBeVisible()
    await expect(
      menu.getByRole("link", { name: workspace.link, exact: true }),
    ).toBeVisible()
    await expect(
      menu.getByRole("link", { name: workspace.hidden, exact: true }),
    ).toHaveCount(0)

    await page.goto("/messages?mode=internal")
    await page.reload()
    await expect(menu.getByText(workspace.title, { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Notifications", exact: true }),
    ).toBeVisible()

    await menu.getByRole("link", { name: "Calendar", exact: true }).click()
    await expect(page).toHaveURL(/\/calendar$/)
    await expect(
      menu.getByRole("link", { name: workspace.link, exact: true }),
    ).toBeVisible()

    for (const label of ["Profile", "Settings"]) {
      await page
        .getByRole("button", { name: "Open account menu", exact: true })
        .click()
      await page.getByRole("menuitem", { name: label, exact: true }).click()
      await expect(page).toHaveURL(
        label === "Profile" ? /\/profile$/ : /\/settings$/,
      )
      await expect(
        menu.getByText(workspace.title, { exact: true }),
      ).toBeVisible()
    }

    await menu
      .getByRole("link", { name: "Switch Workspace", exact: true })
      .click()
    await expect(page).toHaveURL(/\/module$/)
    await expect(page.locator("#app-sidebar")).toHaveCount(0)
    await expect(page.locator("[data-portal-topbar]")).toHaveCount(1)
    await expect
      .poll(() =>
        page.evaluate(() => sessionStorage.getItem("nexus.workspace.actor")),
      )
      .toBeNull()

    await page.goto("/messages?mode=internal")
    await expect(
      menu.getByRole("link", { name: "Switch Workspace", exact: true }),
    ).toBeVisible()
    await expect(menu.getByText(workspace.title, { exact: true })).toHaveCount(
      0,
    )
    await expect(
      menu.getByRole("link", { name: workspace.link, exact: true }),
    ).toHaveCount(0)
  })
}

test("management access loss clears People & HR context", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/employees")
  await page.route("**/api/internal-conversations/contacts", (route) =>
    route.fulfill({ json: [] }),
  )
  await page.getByRole("link", { name: /^Messages/ }).click()
  await expect(page).toHaveURL(/\/messages\?mode=internal$/)
  const menu = mainMenu(page)
  await expect(menu.getByText("People & HR", { exact: true })).toBeVisible()

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: accountFor("ADMIN", { permissions: [] }) } }),
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event("nexus:account-updated")),
  )
  await expect(menu.getByText("People & HR", { exact: true })).toHaveCount(0)
  await expect(
    menu.getByRole("button", { name: "Attendance", exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Employee Management" }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toBeVisible()
  await page.goto("/employees")
  await expect(page).toHaveURL(/\/module$/)
  await expect(page.locator("#app-sidebar")).toHaveCount(0)
  await expect(page.locator("[data-portal-topbar]")).toHaveCount(1)
})

test("remembered module context is isolated by account", async ({ page }) => {
  await restoreSession(page, "ADMIN", { account: { id: "second-admin" } })
  await page.route("**/api/internal-conversations/contacts", (route) =>
    route.fulfill({ json: [] }),
  )
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.workspace.actor", "people-hr"),
  )
  await page.goto("/messages?mode=internal")
  const menu = mainMenu(page)
  await expect(
    menu.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toBeVisible()
  await expect(menu.getByText("People & HR", { exact: true })).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Employee Management" }),
  ).toHaveCount(0)
})

test("authorized deep links replace the previous module and browser history restores it", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/employees")
  const menu = mainMenu(page)
  await expect(menu.getByText("People & HR", { exact: true })).toBeVisible()
  await page.goto("/services")
  await expect(
    menu.getByText("Service Operations", { exact: true }),
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Employee Management" }),
  ).toHaveCount(0)
  await page.goBack()
  await expect(menu.getByText("People & HR", { exact: true })).toBeVisible()
})

test("Admin switches between Service Operations and People & HR scopes", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/dashboard")
  const menu = mainMenu(page)

  await page
    .getByRole("link", {
      name: "Open Service Operations workspace",
      exact: true,
    })
    .click()
  await expect(
    menu.getByRole("link", { name: "Service Management", exact: true }),
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Client Management", exact: true }),
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Employee Management" }),
  ).toHaveCount(0)

  await menu
    .getByRole("link", { name: "Switch Workspace", exact: true })
    .click()
  await page
    .getByRole("link", { name: "Open People & HR workspace", exact: true })
    .click()
  await expect(page).toHaveURL(/\/employees$/)
  await expect(menu.getByText("People & HR", { exact: true })).toBeVisible()
  await expect(
    menu.getByRole("button", { name: "Attendance", exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Department Management", exact: true }),
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Employee Management", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    menu.getByRole("link", { name: "Service Management" }),
  ).toHaveCount(0)
})

test("department head keeps request and workload navigation in their approved modules", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await page.route("**/api/request-inbox?**", (route) =>
    route.fulfill({
      json: {
        department: { id: "design", name: "Design" },
        serviceRequests: [],
        total: 0,
        page: 1,
        pageSize: 10,
      },
    }),
  )
  await page.goto("/dashboard")
  const menu = mainMenu(page)

  await page
    .getByRole("link", {
      name: "Open Service Operations workspace",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/request-inbox$/)
  await expect(
    menu.getByRole("link", { name: "Request Inbox", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(menu.getByRole("link", { name: "Staff Workload" })).toHaveCount(
    0,
  )
  await expect(
    menu.getByRole("link", { name: "Project Workspace" }),
  ).toHaveCount(0)

  await menu
    .getByRole("link", { name: "Switch Workspace", exact: true })
    .click()
  await page
    .getByRole("link", {
      name: "Open Project Management workspace",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/project-workspace$/)
  await expect(
    menu.getByRole("link", { name: "Project Workspace", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    menu.getByRole("link", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
  await expect(menu.getByRole("link", { name: "Request Inbox" })).toHaveCount(0)
})

test("Administration remains the only Superadmin module scope", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.goto("/dashboard")
  await page
    .getByRole("link", { name: "Open Administration workspace", exact: true })
    .click()

  const menu = mainMenu(page)
  await expect(page).toHaveURL(/\/accounts$/)
  await expect(menu.getByText("Administration", { exact: true })).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Account Management", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    menu.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toBeVisible()
})

test("shared and compatibility deep links derive the correct navigation scope", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  await page.route("**/api/project-conversations/project-1", (route) =>
    route.fulfill({
      json: {
        conversation: {
          fullName: "Website launch",
          imageUrl: null,
          position: "Project group chat",
          department: null,
        },
        participants: [],
        project: {
          id: "project-1",
          name: "Website launch",
          description: null,
          status: "IN_PROGRESS",
          startDate: null,
          workspaceId: "workspace-1",
          serviceName: "Website Development",
          referenceNumber: "SR-WEB-001",
        },
        archived: false,
        canSend: true,
        canSubmitDeliverables: false,
        deliverables: [],
        messages: [],
        nextCursor: null,
      },
    }),
  )
  await page.route("**/api/service-requests?**", (route) =>
    route.fulfill({
      json: { serviceRequests: [], total: 0, page: 1, pageSize: 10 },
    }),
  )
  await page.route("**/api/request-workflows/billing", (route) =>
    route.fulfill({ json: [] }),
  )
  const menu = mainMenu(page)

  await page.goto("/messages?project=project-1")
  await expect(page).toHaveURL(/\/messages\?project=project-1$/)
  await expect(page.getByRole("link", { name: /^Messages/ })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(menu.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Switch Workspace" }),
  ).toHaveCount(0)
  await expect(menu.getByRole("link", { name: "Services" })).toBeVisible()
  await expect(menu.getByRole("link", { name: "My Projects" })).toBeVisible()

  await page.goto("/booked-services")
  await expect(
    menu.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByText("Service Operations", { exact: true }),
  ).toHaveCount(0)
  await expect(menu.getByRole("link", { name: "Services" })).toBeVisible()

  await page.goto("/billing-logs")
  await expect(menu.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Switch Workspace" }),
  ).toHaveCount(0)
  await expect(menu.getByRole("link", { name: "Calendar" })).toBeVisible()
})

test("client mobile drawer retains direct navigation when collapsed and closes after navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreSession(page, "USER")
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.layout.sidebar-collapsed", "true"),
  )
  await page.goto("/services")
  await page.getByRole("button", { name: "Open navigation menu" }).click()

  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await expect(
    sidebar.getByText("Service Operations", { exact: true }),
  ).toHaveCount(0)
  await expect(
    sidebar.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toHaveCount(0)
  await expect(
    sidebar.getByRole("link", { name: "Booked Requests", exact: true }),
  ).toBeVisible()
  await expect(sidebar.getByRole("link", { name: "My Projects" })).toHaveCount(
    1,
  )

  await sidebar.getByRole("link", { name: "Dashboard", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator("#app-sidebar")).toHaveAttribute(
    "data-drawer-open",
    "false",
  )
})
