import { test, expect } from "@playwright/test"
import {
  openMockedPolicyOverview,
  policyFigureValue,
  policyOverviewFixture,
  policyOverviewPage,
  policyOverviewSection,
  signIn,
} from "./support"

/** Policy overview figures, inventory and recovery. */
export function policyOverviewTests() {
  test("[PG-009-F001-A002-T002] page requests all policy result pages", async ({
    page,
  }) => {
    const firstPage = Array.from({ length: 200 }, (_, index) =>
      policyOverviewFixture(`policy-${index + 1}`, `Policy ${index + 1}`),
    )
    const secondPage = [
      policyOverviewFixture("policy-201", "Second-page policy"),
    ]
    const summary = {
      totalPolicies: 201,
      activePolicies: 201,
      archivedPolicies: 0,
      assignmentPeriods: 0,
    }
    const requests: string[] = []
    await signIn(page, "admin")
    await page.route("**/api/attendance/policies**", async (route) => {
      const url = new URL(route.request().url())
      requests.push(url.search)
      const pageNumber = Number(url.searchParams.get("page"))
      const policies = pageNumber === 1 ? firstPage : secondPage
      await route.fulfill({
        json: policyOverviewPage(policies, {
          page: pageNumber,
          total: 201,
          summary,
        }),
      })
    })

    await page.goto("/attendance/policies/overview")
    await expect(page.getByLabel("Policy figures")).toHaveAttribute(
      "aria-busy",
      "false",
    )
    expect(requests).toHaveLength(2)
    expect(
      requests.map((search) => {
        const params = new URLSearchParams(search)
        return [
          params.get("page"),
          params.get("size"),
          params.has("status"),
          params.has("search"),
        ]
      }),
    ).toEqual([
      ["1", "200", false, false],
      ["2", "200", false, false],
    ])
  })

  test("[PG-009-F001-A002-T003] failed later policy page hides partial results and retry refetches all pages", async ({
    page,
  }) => {
    const summary = {
      totalPolicies: 201,
      activePolicies: 201,
      archivedPolicies: 0,
      assignmentPeriods: 1,
    }
    const requests: string[] = []
    let pageTwoAttempts = 0
    await signIn(page, "admin")
    await page.route("**/api/attendance/policies**", async (route) => {
      const url = new URL(route.request().url())
      const pageNumber = Number(url.searchParams.get("page"))
      requests.push(String(pageNumber))
      if (pageNumber === 2 && pageTwoAttempts++ === 0) {
        await route.fulfill({
          status: 503,
          json: { error: "Summary temporarily unavailable." },
        })
        return
      }
      const policies =
        pageNumber === 1
          ? [policyOverviewFixture("first", "First page policy")]
          : [policyOverviewFixture("last", "Recovered second-page policy")]
      await route.fulfill({
        json: policyOverviewPage(policies, {
          page: pageNumber,
          total: 201,
          summary,
        }),
      })
    })

    await page.goto("/attendance/policies/overview")
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel("Policy figures")).toHaveAttribute(
      "aria-busy",
      "false",
    )
    const inventory = policyOverviewSection(page, "Recent policy inventory")
    await expect(inventory.getByRole("table")).toHaveCount(0)
    await expect(inventory).toContainText("Policy inventory unavailable.")
    expect(requests).toEqual(["1", "2"])

    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await expect(
      inventory.getByText("First page policy", { exact: true }),
    ).toBeVisible()
    await expect(
      inventory.getByText("Recovered second-page policy", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toHaveCount(0)
    expect(requests).toEqual(["1", "2", "1", "2"])
  })

  test("[PG-009-F001-A003-T002] summary figure labels map to response values", async ({
    page,
  }) => {
    const policies = [
      policyOverviewFixture("one", "Policy one", {
        _count: { assignments: 2 },
      }),
      policyOverviewFixture("two", "Policy two", {
        _count: { assignments: 1 },
      }),
      policyOverviewFixture("three", "Policy three", {
        archivedAt: "2026-11-19T00:00:00.000Z",
        _count: { assignments: 1 },
      }),
    ]
    const response = policyOverviewPage(policies, {
      summary: {
        totalPolicies: 3,
        activePolicies: 2,
        archivedPolicies: 1,
        assignmentPeriods: 4,
      },
    })
    await openMockedPolicyOverview(page, response)

    for (const [label, value] of [
      ["Policies", 3],
      ["Active", 2],
      ["Archived", 1],
      ["Assignment periods", 4],
    ] as const)
      await expect(policyFigureValue(page, label)).toHaveText(String(value))
  })

  test("[PG-009-F001-A004-T001] policy status rows show counts and rounded shares", async ({
    page,
  }) => {
    const policies = [
      policyOverviewFixture("active-1", "Active one"),
      policyOverviewFixture("active-2", "Active two"),
      policyOverviewFixture("active-3", "Active three"),
      policyOverviewFixture("archived-1", "Archived one", {
        archivedAt: "2026-11-19T00:00:00.000Z",
      }),
      policyOverviewFixture("archived-2", "Archived two", {
        archivedAt: "2026-11-18T00:00:00.000Z",
      }),
    ]
    await openMockedPolicyOverview(page, policyOverviewPage(policies))

    const status = policyOverviewSection(page, "Policy status")
    const active = status.getByRole("row").filter({ hasText: "Active" })
    const archived = status.getByRole("row").filter({ hasText: "Archived" })
    await expect(active).toContainText("3")
    await expect(active).toContainText("60%")
    await expect(archived).toContainText("2")
    await expect(archived).toContainText("40%")
    await expect(
      active.getByRole("img", { name: "Active: 3 policies", exact: true }),
    ).toBeVisible()
    await expect(
      archived.getByRole("img", { name: "Archived: 2 policies", exact: true }),
    ).toBeVisible()
  })

  test("[PG-009-F001-A005-T001] assignment history sorts ties and caps display at eight", async ({
    page,
  }) => {
    const ranked = [
      ["Zulu", 5],
      ["Beta", 4],
      ["Alpha", 5],
      ["Hotel", 1],
      ["Echo", 2],
      ["Cedar", 3],
      ["India", 1],
      ["Delta", 2],
      ["Foxtrot", 1],
    ] as const
    const policies = ranked.map(([name, assignments], index) =>
      policyOverviewFixture(`rank-${index}`, name, {
        _count: { assignments },
      }),
    )
    await openMockedPolicyOverview(page, policyOverviewPage(policies))

    const history = policyOverviewSection(page, "Assignment history by policy")
    const rows = history
      .getByRole("table")
      .getByRole("row")
      .filter({
        has: page.locator("td"),
      })
    await expect(rows).toHaveCount(8)
    expect(await rows.locator("td:nth-child(1)").allTextContents()).toEqual([
      "Alpha",
      "Zulu",
      "Beta",
      "Cedar",
      "Delta",
      "Echo",
      "Foxtrot",
      "Hotel",
    ])
    expect(await rows.locator("td:nth-child(2)").allTextContents()).toEqual([
      "5",
      "5",
      "4",
      "3",
      "2",
      "2",
      "1",
      "1",
    ])
    for (const [name, assignments] of [
      ["Alpha", 5],
      ["Zulu", 5],
      ["Beta", 4],
      ["Cedar", 3],
      ["Delta", 2],
      ["Echo", 2],
      ["Foxtrot", 1],
      ["Hotel", 1],
    ] as const)
      await expect(
        history.getByRole("img", {
          name: `${name}: ${assignments} assignment periods`,
          exact: true,
        }),
      ).toBeVisible()
    await expect(history.getByText("India", { exact: true })).toHaveCount(0)
  })

  test("[PG-009-F001-A006-T001] recent inventory preserves response order and displays eight rows", async ({
    page,
  }) => {
    const policies = Array.from({ length: 9 }, (_, index) =>
      policyOverviewFixture(
        `inventory-${index + 1}`,
        `Inventory ${index + 1}`,
        {
          timeZone: `Region/Zone${index + 1}`,
          archivedAt: index % 2 === 0 ? null : "2026-11-19T00:00:00.000Z",
          _count: { assignments: index + 2 },
        },
      ),
    )
    await openMockedPolicyOverview(page, policyOverviewPage(policies))

    const inventory = policyOverviewSection(page, "Recent policy inventory")
    await expect(inventory).toContainText("9 shown")
    const rows = inventory
      .getByRole("table")
      .getByRole("row")
      .filter({
        has: page.locator("td"),
      })
    await expect(rows).toHaveCount(8)
    expect(await rows.locator("td:nth-child(1)").allTextContents()).toEqual(
      Array.from({ length: 8 }, (_, index) =>
        index % 2 === 0
          ? `Inventory ${index + 1}Active`
          : `Inventory ${index + 1}Archived`,
      ),
    )
    expect(await rows.locator("td:nth-child(2)").allTextContents()).toEqual(
      Array.from({ length: 8 }, (_, index) => `Region/Zone${index + 1}`),
    )
    expect(await rows.locator("td:nth-child(3)").allTextContents()).toEqual(
      Array.from({ length: 8 }, (_, index) => String(index + 2)),
    )
    await expect(
      inventory.getByText("Inventory 9", { exact: false }),
    ).toHaveCount(0)
  })

  test("[PG-009-F001-A007-T001] active policies without history are filtered and alphabetized", async ({
    page,
  }) => {
    const policies = [
      policyOverviewFixture("zulu", "Zulu"),
      policyOverviewFixture("assigned", "Assigned", {
        _count: { assignments: 1 },
      }),
      policyOverviewFixture("old", "Old", {
        archivedAt: "2026-11-19T00:00:00.000Z",
      }),
      policyOverviewFixture("alpha", "Alpha"),
    ]
    await openMockedPolicyOverview(page, policyOverviewPage(policies))

    const section = policyOverviewSection(
      page,
      "Active policies without assignment history",
    )
    expect(await section.locator("dt").allTextContents()).toEqual([
      "Alpha",
      "Zulu",
    ])
    await expect(section.locator("dd")).toHaveText([
      "No assignment history",
      "No assignment history",
    ])
  })

  test("[PG-009-F001-A007-T002] active policies without history has its empty state", async ({
    page,
  }) => {
    const policies = [
      policyOverviewFixture("old", "Old", {
        archivedAt: "2026-11-19T00:00:00.000Z",
      }),
      policyOverviewFixture("assigned", "Assigned", {
        _count: { assignments: 1 },
      }),
    ]
    await openMockedPolicyOverview(page, policyOverviewPage(policies))

    const section = policyOverviewSection(
      page,
      "Active policies without assignment history",
    )
    await expect(section).toContainText(
      "No active policies without assignment history in this preview.",
    )
    await expect(section.locator("dl")).toHaveCount(0)
  })

  test("[PG-009-F001-A010-T001] policy overview displays loading and recovers after retry", async ({
    page,
  }) => {
    let calls = 0
    let releaseFirst: (() => void) | undefined
    let signalFirst: (() => void) | undefined
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstSeen = new Promise<void>((resolve) => {
      signalFirst = resolve
    })
    const success = policyOverviewPage(
      [policyOverviewFixture("recovered", "Recovered policy")],
      {
        summary: {
          totalPolicies: 1,
          activePolicies: 1,
          archivedPolicies: 0,
          assignmentPeriods: 0,
        },
      },
    )
    await signIn(page, "admin")
    await page.route("**/api/attendance/policies**", async (route) => {
      calls += 1
      if (calls === 1) {
        signalFirst?.()
        await firstPending
        await route.fulfill({
          status: 503,
          json: { error: "Summary temporarily unavailable." },
        })
        return
      }
      await route.fulfill({ json: success })
    })

    await page.goto("/attendance/policies/overview")
    await firstSeen
    await expect(page.getByLabel("Policy figures")).toHaveAttribute(
      "aria-busy",
      "true",
    )
    const loadingSkeleton = policyOverviewSection(
      page,
      "Policy status",
    ).locator('[aria-hidden="true"]')
    await expect(loadingSkeleton).toHaveCount(3)
    await expect(loadingSkeleton.first()).toBeVisible()
    releaseFirst?.()
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel("Policy figures")).toHaveAttribute(
      "aria-busy",
      "false",
    )
    await expect(policyOverviewSection(page, "Policy status")).toContainText(
      "Policy summaries unavailable.",
    )
    await expect(
      policyOverviewSection(page, "Assignment history by policy"),
    ).toContainText("Assignment history unavailable.")
    await expect(
      policyOverviewSection(page, "Recent policy inventory"),
    ).toContainText("Policy inventory unavailable.")
    await expect(
      policyOverviewSection(page, "Active policies without assignment history"),
    ).toContainText("Policy summaries unavailable.")
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await expect(
      policyOverviewSection(page, "Recent policy inventory").getByText(
        "Recovered policy",
        { exact: true },
      ),
    ).toBeVisible()
    await expect(policyFigureValue(page, "Policies")).toHaveText("1")
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toHaveCount(0)
    expect(calls).toBe(2)
  })

  test("[PG-009-F001-A010-T002] empty policy inventory shows coordinated empty states", async ({
    page,
  }) => {
    await openMockedPolicyOverview(
      page,
      policyOverviewPage([], {
        summary: {
          totalPolicies: 0,
          activePolicies: 0,
          archivedPolicies: 0,
          assignmentPeriods: 0,
        },
      }),
    )

    for (const label of [
      "Policies",
      "Active",
      "Archived",
      "Assignment periods",
    ])
      await expect(policyFigureValue(page, label)).toHaveText("0")
    await expect(policyOverviewSection(page, "Policy status")).toContainText(
      "No policies yet.",
    )
    await expect(
      policyOverviewSection(page, "Policy status").getByRole("table"),
    ).toHaveCount(0)
    await expect(
      policyOverviewSection(page, "Assignment history by policy"),
    ).toContainText("No assignment history among the latest policies.")
    await expect(
      policyOverviewSection(page, "Recent policy inventory"),
    ).toContainText("No policies. Open Management to create a policy.")
    await expect(
      policyOverviewSection(page, "Active policies without assignment history"),
    ).toContainText(
      "No active policies without assignment history in this preview.",
    )
    await expect(page.getByRole("table")).toHaveCount(0)
  })
}
