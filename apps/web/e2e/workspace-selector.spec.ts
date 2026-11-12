import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Workspace selector regressions use isolated API fixtures")

const scenarios = [
  {
    label: "Staff",
    role: "STAFF",
    expected: [["Project Management", "/project-workspace"]],
  },
  {
    label: "department head",
    role: "STAFF",
    account: { headOf: { id: "design", name: "Design" } },
    expected: [
      ["Service Operations", "/request-inbox"],
      ["Project Management", "/project-workspace"],
    ],
  },
  {
    label: "Admin",
    role: "ADMIN",
    expected: [
      ["Service Operations", "/services"],
      ["People & HR", "/employees"],
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

    await expect(
      page.getByRole("heading", { name: "Choose a workspace", exact: true }),
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
    await expect(
      page.getByRole("main", { name: "Client dashboard" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /^Open .+ workspace$/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Choose a workspace" }),
    ).toHaveCount(0)
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
      sidebar.getByRole("link", { name: "Switch workspace" }),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}
