import { expect, test, type Page } from "@playwright/test"
import type { ProjectWorkspace } from "../../src/features/projects/api/projects-api"
import { accountFor, configureRegressionTest } from "../regression-support"

configureRegressionTest()

async function mockProject(page: Page, contributor: boolean) {
  const project: ProjectWorkspace = {
    id: "project-1",
    name: "Business website",
    description: "An accessible five-page website",
    status: "IN_PROGRESS",
    startDate: "2026-10-30T10:00:00Z",
    createdAt: "2026-10-30T09:30:00Z",
    workspaceManaged: false,
    canManage: contributor,
    request: {
      id: "request-1",
      referenceNumber: "SR-2026-100",
      service: { name: "Website Development" },
    },
    milestones: [
      {
        id: "milestone-1",
        title: "Design approval",
        completedAt: null,
        deliveryStatus: "NOT_SUBMITTED",
        sentToClientAt: null,
      },
    ],
  }
  const writes: unknown[] = []
  const state = { failUpdate: false }
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "project-session"),
  )
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    expect(route.request().headers().authorization).toBe(
      "Bearer project-session",
    )
    if (path === "/api/auth/me")
      return route.fulfill({
        json: { user: accountFor(contributor ? "STAFF" : "USER") },
      })
    if (path === "/api/request-workflows/notifications")
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    if (path === "/api/projects/project-1")
      return route.fulfill({ json: project })
    if (path === "/api/projects/project-1/milestones/milestone-1") {
      expect(route.request().method()).toBe("PATCH")
      const input = route.request().postDataJSON() as { completed: boolean }
      writes.push(input)
      if (state.failUpdate)
        return route.fulfill({
          status: 503,
          json: { error: "Milestone temporarily unavailable" },
        })
      project.milestones[0]!.completedAt = input.completed
        ? "2026-10-30T11:00:00Z"
        : null
      return route.fulfill({ json: project })
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } })
  })
  return { writes, state }
}

test("client project workspace shows milestones and conversation handoff on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { writes } = await mockProject(page, false)
  await page.goto("/projects/project-1")
  await expect(
    page.getByRole("heading", { name: "Business website", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Design approval", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "View service conversation" }),
  ).toHaveAttribute("href", "/messages?request=request-1")
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(
    0,
  )
  expect(writes).toHaveLength(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

for (const width of [1440, 390]) {
  test(`failed milestone updates preserve progress and can be retried at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const { writes, state } = await mockProject(page, true)
    state.failUpdate = true
    await page.goto("/projects/project-1")
    await page
      .getByRole("button", { name: "Mark complete", exact: true })
      .click()
    await expect(
      page.getByText("Couldn't update milestone", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("0/1 completed", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Mark complete", exact: true }),
    ).toBeEnabled()
    state.failUpdate = false
    await page
      .getByRole("button", { name: "Mark complete", exact: true })
      .click()
    await expect(page.getByText("1/1 completed", { exact: true })).toBeVisible()
    expect(writes).toEqual([{ completed: true }, { completed: true }])
  })
}

test("assigned staff can complete and reopen a project milestone", async ({
  page,
}) => {
  const { writes } = await mockProject(page, true)
  await page.goto("/projects/project-1")
  await page.getByRole("button", { name: "Mark complete" }).click()
  await expect(page.getByText("1/1 completed", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Reopen", exact: true }).click()
  await expect(page.getByText("0/1 completed", { exact: true })).toBeVisible()
  expect(writes).toEqual([{ completed: true }, { completed: false }])
  await expect(
    page.getByRole("link", { name: "View service conversation" }),
  ).toHaveCount(0)
})
