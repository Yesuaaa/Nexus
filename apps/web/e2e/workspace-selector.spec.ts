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
      ["Workforce Compliance", "/attendance/check-ins"],
    ],
  },
  {
    label: "department head",
    role: "STAFF",
    account: { headOf: { id: "design", name: "Design" } },
    expected: [
      ["Service Operations", "/request-inbox"],
      ["Project Management", "/project-workspace"],
      ["Workforce Compliance", "/attendance/overview"],
    ],
  },
  {
    label: "Admin",
    role: "ADMIN",
    expected: [
      ["Service Operations", "/services"],
      ["People & HR", "/employees"],
      ["Workforce Compliance", "/attendance/overview"],
    ],
  },
  {
    label: "Superadmin",
    role: "SUPERADMIN",
    expected: [
      ["Service Operations", "/services"],
      ["Project Management", "/project-management/overview"],
      ["People & HR", "/employees"],
      ["Workforce Compliance", "/attendance/time-logs/overview"],
      ["Administration", "/accounts"],
    ],
  },
] as const

for (const width of [390, 715, 1440]) {
  test(`workspace carousel stays centered at both limits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await restoreSession(page, "SUPERADMIN")
    await page.goto("/module")
    const carousel = page.locator('[aria-roledescription="carousel"]')
    const first = carousel.getByRole("link", {
      name: "Open Service Operations workspace",
      exact: true,
    })
    const last = carousel.getByLabel("Billing & Finance module coming soon")

    // Focus distant cards, as keyboard navigation does. Native scrolling of a
    // clipped track must not compete with the carousel's own positioning.
    for (const [card, key, button] of [
      [last, "ArrowRight", "Next module"],
      [first, "ArrowLeft", "Previous module"],
    ] as const) {
      await card.focus()
      await expect(card).toBeFocused()
      await page.keyboard.press(key)
      await page.keyboard.press(key)
      await expect(
        carousel.getByRole("button", { name: button }),
      ).toBeDisabled()
      await expect
        .poll(async () => {
          const bounds = await carousel.boundingBox()
          const cardBounds = await card.boundingBox()
          if (!bounds || !cardBounds) return Infinity
          return Math.abs(
            cardBounds.x + cardBounds.width / 2 - (bounds.x + bounds.width / 2),
          )
        })
        .toBeLessThan(1)
      await expect(card).toBeInViewport({ ratio: 1 })
    }
    await first.click()
    await expect(page).toHaveURL(/\/services$/)
  })
}

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

    const cards = page.getByRole("link", {
      name: /^Open .+ workspace$/,
      includeHidden: true,
    })
    await expect(cards).toHaveCount(scenario.expected.length)
    await expect(page.locator('[aria-roledescription="carousel"]')).toHaveCount(
      scenario.expected.length + 1 > 5 ? 1 : 0,
    )

    for (const [title, href] of scenario.expected) {
      await expect(
        page.getByRole("link", {
          name: `Open ${title} workspace`,
          exact: true,
        }),
      ).toHaveAttribute("href", href)
    }

    await expect(
      page.getByRole("heading", { name: "Billing & Finance", exact: true }),
    ).toBeVisible()
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

test("anonymous users cannot open the selector or a dynamic module route", async ({
  page,
}) => {
  for (const path of ["/module", "/module/project-management"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible()
    await expect(
      page.getByRole("main", { name: "Workspace selector" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("main", { name: "Administrative workspace" }),
    ).toHaveCount(0)
  }
  expect(await storedTokens(page)).toEqual([null, null])
})

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
        const workspaceName = await page
          .getByRole("link", { name: /^Open .+ workspace$/ })
          .first()
          .getAttribute("aria-label")
        const workspace = page.getByRole("link", {
          name: workspaceName!,
          exact: true,
        })
        await workspace.focus()
        await workspace.click()
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
