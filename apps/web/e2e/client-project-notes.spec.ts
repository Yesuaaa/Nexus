import { expect, test } from "@playwright/test"
import { accountFor, configureRegressionTest } from "./regression-support"

configureRegressionTest()

test("client project notes keep the brief and empty state usable at common widths", async ({
  page,
}) => {
  const projectId = "client-project-notes-1"
  const description = `${"Detailed project context and requirements. ".repeat(30)}\nFinal requirements remain intact.`

  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: accountFor("USER") } })
    if (path === `/api/projects/${projectId}`)
      return route.fulfill({
        json: {
          id: projectId,
          name: "Client project notes",
          description,
          status: "IN_PROGRESS",
          startDate: null,
          createdAt: "2026-11-01T00:00:00.000Z",
          workspaceManaged: true,
          canManage: false,
          request: null,
          milestones: [],
          deliverables: [],
        },
      })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto(`/projects/${projectId}?tab=notes`)

  const main = page.getByRole("main")
  const briefHeading = main.getByRole("heading", {
    name: "Project brief",
    exact: true,
  })
  const brief = briefHeading.locator("xpath=..")
  const notesHeading = main.getByRole("heading", {
    name: "Project notes",
    exact: true,
  })

  await expect(briefHeading).toBeVisible()
  await expect(brief.locator("p")).toHaveText(description)
  await expect(
    main.getByRole("heading", { name: "No project notes yet", exact: true }),
  ).toBeVisible()
  await expect(
    main.getByText(
      "Updates and notes shared by your project team will appear here.",
      { exact: true },
    ),
  ).toBeVisible()
  await expect(notesHeading).toBeVisible()

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const dimensions = await main.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(
      dimensions.scrollWidth,
      `Project Notes should not overflow at ${width}px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth)
  }
})
