import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
  storedTokens,
} from "../regression-support"

configureRegressionTest()
test.skip(live, "Portal regressions use isolated API fixtures")

for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
  test(`${role} opens settings without losing its session and cannot open head-only workload`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    await page.goto("/settings")
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("tab", { name: "Security", exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
    expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])

    const workloadRequests: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/workload")
        workloadRequests.push(request.url())
    })
    await page.goto("/staff-workload")
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(workloadRequests).toEqual([])
    await expect(
      page.getByRole("link", { name: "Workflow Approvals", exact: true }),
    ).toHaveCount(0)
  })
}

test("department head opens workload with a Monday query and retains access after reload", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-07T08:00:00Z"))
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let reads = 0
  await page.route("**/api/workload?*", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer test-session")
    expect(new URL(route.request().url()).searchParams.get("week")).toBe(
      "2026-11-02",
    )
    reads++
    await route.fulfill({
      json: {
        department: { id: "design", name: "Design" },
        week: "2026-11-02",
        projects: [],
        staff: [],
      },
    })
  })
  await page.goto("/staff-workload")
  await expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
  await expect.poll(() => reads).toBeGreaterThan(0)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
  await expect.poll(() => reads).toBeGreaterThan(1)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})
