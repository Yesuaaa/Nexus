import { expect, test, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  mockApi,
  restoreSession,
  storedTokens,
  testAccounts,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Workspace selector regressions use isolated API fixtures")

async function expectLauncher(page: Page) {
  await expect(
    page.getByRole("main", { name: "Workspace selector" }),
  ).toBeVisible()
  await expect(page.locator("#app-sidebar")).toHaveCount(0)
  await expect(page.locator("[data-portal-topbar]")).toHaveCount(1)
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Open navigation menu" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("group", { name: "Account controls" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Module", exact: true }),
  ).toBeVisible()
}

const scenarios = [
  {
    label: "Staff",
    role: "STAFF",
    expected: [
      ["Project Management", "/project-workspace"],
      ["Attendance & Monitoring", "/attendance/check-ins"],
    ],
  },
  {
    label: "department head",
    role: "STAFF",
    account: { headOf: { id: "design", name: "Design" } },
    expected: [
      ["Service Operations", "/request-inbox"],
      ["Project Management", "/project-workspace"],
      ["Attendance & Monitoring", "/attendance/overview"],
    ],
  },
  {
    label: "Admin",
    role: "ADMIN",
    expected: [
      ["Service Operations", "/services"],
      ["People & HR", "/employees"],
      ["Attendance & Monitoring", "/attendance/overview"],
    ],
  },
  {
    label: "Superadmin",
    role: "SUPERADMIN",
    expected: [["Administration", "/accounts"]],
  },
] as const

for (const scenario of scenarios) {
  test(`${scenario.label} sees only authorized workspace cards`, async ({
    page,
  }) => {
    await restoreSession(page, scenario.role, {
      account: "account" in scenario ? scenario.account : undefined,
    })
    await page.goto("/dashboard")
    await expectLauncher(page)

    await expect(
      page.getByRole("heading", { name: "Module", exact: true }),
    ).toBeVisible()

    const cards = page.getByRole("link", { name: /^Open .+ workspace$/ })
    await expect(cards).toHaveCount(scenario.expected.length)

    for (const [title, href] of scenario.expected) {
      await expect(
        page.getByRole("link", {
          name: `Open ${title} workspace`,
          exact: true,
        }),
      ).toHaveAttribute("href", href)
    }

    await expect(
      page.getByText("Finance & Billing", { exact: true }),
    ).toHaveCount(0)
    await expect(page.getByText("Scheduling", { exact: true })).toHaveCount(0)
  })
}

test("an account without module permissions sees a safe empty state", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN", { account: { permissions: [] } })
  await page.goto("/dashboard")
  await expectLauncher(page)

  await expect(
    page.getByRole("heading", {
      name: "No workspaces available",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: /^Open .+ workspace$/ }),
  ).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`clients have direct navigation without a workspace selector at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await restoreSession(page, "USER")
    await page.goto("/")
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto("/module")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("main", { name: "Client dashboard" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /^Open .+ workspace$/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("banner", { name: "Workspace selector" }),
    ).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Module" })).toHaveCount(0)
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const sidebar = page.getByRole("complementary", {
      name: "Primary navigation",
    })
    for (const label of [
      "Dashboard",
      "Services",
      "Booked Requests",
      "My Projects",
      "Calendar",
      "Help & Support",
    ]) {
      await expect(
        sidebar.getByRole("link", { name: label, exact: true }),
      ).toBeVisible()
    }
    await expect(
      sidebar.getByRole("link", { name: "Switch Workspace" }),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

for (const width of [390, 768, 1440]) {
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN", "USER"] as const) {
    test(`${role} login uses its correct shell at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 })
      await mockApi(page, role)
      const applicationReads: string[] = []
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname
        if (
          /^\/api\/(request-conversations|project-conversations|internal-conversations|request-workflows)/.test(
            path,
          )
        )
          applicationReads.push(path)
      })
      await page.goto(role === "USER" ? "/login" : "/internal/login")
      await page
        .getByLabel("Email address", { exact: true })
        .fill(testAccounts[role].email)
      await page
        .getByLabel("Password", { exact: true })
        .fill("CorrectHorse123!")
      await page.getByRole("button", { name: "Sign In", exact: true }).click()
      await expect(page).toHaveURL(
        role === "USER" ? /\/dashboard$/ : /\/module$/,
      )
      await expect(
        page.getByRole("status", { name: "Opening your account" }),
      ).toHaveCount(0)
      if (role === "USER") {
        await expect(
          page.getByRole("main", { name: "Client dashboard" }),
        ).toBeVisible()
        await expect(
          page.getByRole("main", { name: "Workspace selector" }),
        ).toHaveCount(0)
        await expect(page.locator("[data-portal-topbar]")).toHaveCount(1)
      } else {
        await expectLauncher(page)
        if (role === "ADMIN" && width !== 768)
          await page.screenshot({
            path: test.info().outputPath("module.png"),
            fullPage: true,
          })
        expect(applicationReads).toEqual([])
        await page.reload()
        await expectLauncher(page)
        await page
          .getByRole("link", { name: /^Open .+ workspace$/ })
          .first()
          .click()
        await expect(page.locator("[data-portal-topbar]")).toBeVisible()
        if (width < 768)
          await page
            .getByRole("button", { name: "Open navigation menu" })
            .click()
        await page
          .getByRole("link", { name: "Switch Workspace", exact: true })
          .click()
        await expect(page).toHaveURL(/\/module$/)
        await expectLauncher(page)
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
      await page
        .getByRole("button", { name: "Open account menu", exact: true })
        .click()
      await page.getByRole("menuitem", { name: "Log out", exact: true }).click()
      await expect(page).toHaveURL(
        role === "USER" ? /\/login$/ : /\/internal\/login$/,
      )
      expect(await storedTokens(page)).toEqual([null, null])
    })
  }
}
