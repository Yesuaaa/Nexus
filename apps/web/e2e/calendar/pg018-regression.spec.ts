import { test, expect, type Page, type Route } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"
import type { CalendarEvent } from "../../src/features/calendar/model/calendar"

configureRegressionTest()
const instant = "2030-02-03T02:00:00Z"
function event(
  id: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    title: id,
    type: "meeting",
    context: "Calendar fixture",
    startsAt: "2030-02-03T03:00:00Z",
    endsAt: "2030-02-03T04:00:00Z",
    location: null,
    staff: "Staff",
    pending: false,
    href: null,
    completed: false,
    deadline: false,
    staffMembers: [{ id: "staff", name: "Staff" }],
    project: { id: "alpha", name: "Alpha" },
    department: { id: "design", name: "Design" },
    ...overrides,
  }
}
async function prepare(
  page: Page,
  role: "USER" | "STAFF" | "ADMIN",
  handler: (route: Route) => Promise<unknown>,
  time = instant,
) {
  await page.clock.install({ time: new Date(time) })
  await restoreSession(page, role)
  await page.route("**/api/projects/calendar**", handler)
}
const main = (page: Page) => page.getByRole("main", { name: "Your calendar" })
const day = (page: Page) =>
  main(page).getByRole("region", { name: "Sunday, February 3" })
async function select(page: Page, label: string, value: string) {
  await main(page).getByRole("combobox", { name: label, exact: true }).click()
  await page.getByRole("option", { name: value, exact: true }).click()
}
function payload(events: CalendarEvent[], role: "USER" | "STAFF" | "ADMIN") {
  return role === "USER"
    ? events
    : { events, canViewTeam: true, organization: role === "ADMIN" }
}

test("[PG-018-F001-A002-T001] initial loading accepts client arrays and internal envelopes and sorts source events", async ({
  page,
}) => {
  for (const role of ["USER", "STAFF"] as const) {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reads: string[] = []
    await prepare(page, role, async (route) => {
      reads.push(new URL(route.request().url()).search)
      await gate
      await route.fulfill({
        json: payload(
          [
            event("Later", {
              startsAt: "2030-02-03T05:00:00Z",
              endsAt: "2030-02-03T06:00:00Z",
            }),
            event("Earlier"),
          ],
          role,
        ),
      })
    })
    await page.goto("/calendar")
    try {
      await expect(
        day(page).getByText("Loading calendar\u2026", { exact: true }),
      ).toBeVisible()
    } finally {
      release()
    }
    await expect(day(page).getByRole("listitem")).toHaveCount(2)
    await expect(day(page).getByRole("listitem").nth(0)).toContainText(
      "Earlier",
    )
    await expect(day(page).getByRole("listitem").nth(1)).toContainText("Later")
    expect(reads).toEqual([role === "USER" ? "" : "?scope=mine&month=2030-02"])
    await page.goto("/services")
    await page.unroute("**/api/projects/calendar**")
  }
})

test("[PG-018-F001-A004-T001] focus refresh replaces events and failed refresh removes stale rows before retry", async ({
  page,
}) => {
  let reads = 0
  await prepare(page, "STAFF", async (route) => {
    reads++
    await route.fulfill(
      reads === 3
        ? { status: 503, json: { error: "Synthetic refresh unavailable" } }
        : {
            json: payload(
              [event(reads === 1 ? "Original" : "Refreshed")],
              "STAFF",
            ),
          },
    )
  })
  await page.goto("/calendar")
  await expect(day(page).getByText("Original", { exact: true })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(day(page).getByText("Refreshed", { exact: true })).toBeVisible()
  await expect(day(page).getByText("Original", { exact: true })).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(
    main(page).getByRole("button", { name: "Try again" }),
  ).toBeVisible()
  await expect(day(page).getByText("Refreshed", { exact: true })).toHaveCount(0)
  await expect(
    day(page).getByText("Calendar unavailable.", { exact: true }),
  ).toBeVisible()
  await main(page).getByRole("button", { name: "Try again" }).click()
  await expect(day(page).getByText("Refreshed", { exact: true })).toBeVisible()
  expect(reads).toBe(4)
})

test("[PG-018-F001-A004-T002] stale scope and month reads cannot overwrite current or remounted calendar state", async ({
  page,
}) => {
  const pending: { release: () => void; done: Promise<void> }[] = []
  let delayed = false,
    generation = "Initial"
  await prepare(page, "STAFF", async (route) => {
    const captured = generation
    if (delayed) {
      let release!: () => void, complete!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const done = new Promise<void>((resolve) => {
        complete = resolve
      })
      pending.push({ release, done })
      await gate
      try {
        await route.fulfill({ json: payload([event(captured)], "STAFF") })
      } catch {
        /* Browser abort is expected after scope cleanup. */
      } finally {
        complete()
      }
    } else await route.fulfill({ json: payload([event(captured)], "STAFF") })
  })
  try {
    await page.goto("/calendar")
    await expect(day(page).getByText("Initial", { exact: true })).toBeVisible()
    delayed = true
    generation = "Stale scope"
    await select(page, "Calendar scope", "My team")
    await expect.poll(() => pending.length).toBe(1)
    delayed = false
    generation = "Current mine"
    await select(page, "Calendar scope", "My schedule")
    await expect(
      day(page).getByText("Current mine", { exact: true }),
    ).toBeVisible()
    pending[0].release()
    await pending[0].done
    await expect(
      day(page).getByText("Stale scope", { exact: true }),
    ).toHaveCount(0)
    delayed = true
    generation = "Stale month"
    await main(page).getByRole("button", { name: "Next month" }).click()
    await expect.poll(() => pending.length).toBe(2)
    delayed = false
    generation = "Current February"
    await main(page).getByRole("button", { name: "Previous month" }).click()
    await expect(
      day(page).getByText("Current February", { exact: true }),
    ).toBeVisible()
    pending[1].release()
    await pending[1].done
    await expect(
      day(page).getByText("Stale month", { exact: true }),
    ).toHaveCount(0)
    delayed = true
    generation = "Stale unmounted"
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await expect.poll(() => pending.length).toBe(3)
    await page.goto("/services")
    pending[2].release()
    await pending[2].done
    delayed = false
    generation = "Remounted"
    await page.goto("/calendar")
    await expect(
      day(page).getByText("Remounted", { exact: true }),
    ).toBeVisible()
    await expect(
      main(page).getByText("Stale unmounted", { exact: true }),
    ).toHaveCount(0)
  } finally {
    for (const request of pending) request.release()
    await Promise.all(pending.map((request) => request.done))
  }
})

test("[PG-018-F001-A006-T002] calendar keyboard arrows, Home, End and PageDown preserve roving focus and clamp leap day", async ({
  page,
}) => {
  await prepare(
    page,
    "USER",
    (route) => route.fulfill({ json: [] }),
    "2032-01-31T02:00:00Z",
  )
  await page.goto("/calendar")
  const date = (value: string) =>
    main(page).locator(`button[data-date="${value}"]`)
  await date("2032-01-31").focus()
  for (const [key, value] of [
    ["ArrowLeft", "2032-01-30"],
    ["ArrowRight", "2032-01-31"],
    ["ArrowUp", "2032-01-24"],
    ["ArrowDown", "2032-01-31"],
    ["Home", "2032-01-26"],
    ["End", "2032-02-01"],
  ]) {
    await page.keyboard.press(key)
    await expect(date(value)).toBeFocused()
    await expect(date(value)).toHaveAttribute("tabindex", "0")
  }
  await main(page).getByRole("button", { name: "Today", exact: true }).click()
  await date("2032-01-31").focus()
  await page.keyboard.press("PageDown")
  await expect(date("2032-02-29")).toBeFocused()
  await expect(
    main(page).getByRole("grid", { name: "February 2032" }),
  ).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(
    main(page).getByRole("region", { name: "Sunday, February 29" }),
  ).toBeVisible()
  await expect(date("2032-02-29").locator("..")).toHaveAttribute(
    "aria-selected",
    "true",
  )
})

test("[PG-018-F001-A007-T002] dense markers keep accessible titles, milestone-first agenda and responsive dots", async ({
  page,
}) => {
  const events = [
    event("Meeting first"),
    event("Milestone first", {
      type: "milestone",
      startsAt: "2030-02-03T05:00:00Z",
      endsAt: null,
    }),
    event("Task third", { type: "task", deadline: true }),
    event("Consultation fourth", { type: "consultation" }),
  ]
  await prepare(page, "USER", (route) => route.fulfill({ json: events }))
  await page.goto("/calendar")
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(day(page).getByText("4 events", { exact: true })).toBeVisible()
    await expect(day(page).getByRole("listitem").first()).toContainText(
      "Milestone first",
    )
    const cell = main(page).locator('button[data-date="2030-02-03"]')
    for (const item of events)
      await expect(cell).toHaveAttribute("aria-label", new RegExp(item.title))
    if (width === 1440)
      await expect(cell.getByText("+2 more", { exact: true })).toBeVisible()
    else {
      await expect(cell.getByText("+2 more", { exact: true })).toBeHidden()
      await expect(
        cell
          .locator('span[aria-hidden="true"]')
          .last()
          .locator(":scope > span"),
      ).toHaveCount(3)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
})

test("[PG-018-F001-A008-T001] upcoming excludes selected-day, completed, milestone and expired events and caps ordered rows at three", async ({
  page,
}) => {
  const events = [
    event("Selected day"),
    event("Expired", {
      startsAt: "2030-02-02T01:00:00Z",
      endsAt: "2030-02-02T02:00:00Z",
    }),
    event("Completed", { startsAt: "2030-02-04T03:00:00Z", completed: true }),
    event("Milestone", { type: "milestone", startsAt: "2030-02-04T03:00:00Z" }),
    ...[4, 5, 6, 7].map((n) =>
      event(`Upcoming ${n}`, {
        startsAt: `2030-02-0${n}T03:00:00Z`,
        endsAt: `2030-02-0${n}T04:00:00Z`,
        pending: n === 4,
      }),
    ),
  ].reverse()
  await prepare(page, "USER", (route) => route.fulfill({ json: events }))
  await page.goto("/calendar")
  const upcoming = main(page).getByRole("region", { name: "Coming up next" })
  await expect(upcoming.getByRole("listitem")).toHaveCount(3)
  for (const [index, title] of [
    "Upcoming 4",
    "Upcoming 5",
    "Upcoming 6",
  ].entries())
    await expect(upcoming.getByRole("listitem").nth(index)).toContainText(title)
  for (const title of [
    "Selected day",
    "Expired",
    "Completed",
    "Milestone",
    "Upcoming 7",
  ])
    await expect(upcoming.getByText(title, { exact: true })).toHaveCount(0)
  await expect(upcoming.getByText("Pending", { exact: true })).toBeVisible()
})

test("[PG-018-F001-A009-T002] Join includes the 15-minute threshold, excludes exact end and moves to the first eligible meeting each minute", async ({
  page,
}) => {
  const events = [
    event("Completed meeting", {
      completed: true,
      startsAt: "2030-02-03T01:00:00Z",
      endsAt: "2030-02-03T03:00:00Z",
      location: "https://example.test/completed",
    }),
    event("Ended", {
      startsAt: "2030-02-03T01:00:00Z",
      endsAt: instant,
      location: "https://example.test/ended",
    }),
    event("Threshold", {
      startsAt: "2030-02-03T02:15:00Z",
      endsAt: "2030-02-03T02:16:00Z",
      location: "https://example.test/threshold",
    }),
    event("Next", {
      startsAt: "2030-02-03T02:16:00Z",
      endsAt: "2030-02-03T03:00:00Z",
      location: "https://example.test/next",
    }),
  ]
  await prepare(page, "USER", (route) =>
    route.fulfill({ json: events.reverse() }),
  )
  await page.goto("/calendar")
  const join = main(page).getByRole("link", {
    name: "Join meeting",
    exact: true,
  })
  await expect(join).toHaveCount(1)
  await expect(join).toHaveAttribute("href", "https://example.test/threshold")
  await expect(join).toHaveAttribute("target", "_blank")
  await expect(join).toHaveAttribute("rel", /noopener noreferrer/)
  await page.clock.runFor(60000)
  await expect(join).toHaveAttribute("href", "https://example.test/threshold")
  await page.clock.runFor(15 * 60000)
  await expect(join).toHaveCount(1)
  await expect(join).toHaveAttribute("href", "https://example.test/next")
})

test("[PG-018-F001-A011-T002] scope changes reset project while preserving event type and day; revoked team access clears data", async ({
  page,
}) => {
  let revoked = false
  const reads: string[] = []
  await prepare(page, "STAFF", async (route) => {
    const url = new URL(route.request().url())
    reads.push(url.search)
    await route.fulfill(
      revoked && url.searchParams.get("scope") === "team"
        ? { status: 403, json: { error: "Team calendar access is required" } }
        : {
            json: payload(
              [
                event("Visible task", { type: "task", deadline: true }),
                event("Hidden meeting"),
              ],
              "STAFF",
            ),
          },
    )
  })
  await page.goto("/calendar")
  await expect(
    day(page).getByText("Visible task", { exact: true }),
  ).toBeVisible()
  await select(page, "Event types", "Task deadline")
  await select(page, "Projects", "Alpha")
  await select(page, "Calendar scope", "My team")
  await expect(
    main(page).getByRole("combobox", { name: "Projects", exact: true }),
  ).toContainText("All projects")
  await expect(
    main(page).getByRole("combobox", { name: "Event types", exact: true }),
  ).toContainText("Task deadline")
  await expect(
    day(page).getByText("Visible task", { exact: true }),
  ).toBeVisible()
  await expect(
    day(page).getByText("Hidden meeting", { exact: true }),
  ).toHaveCount(0)
  revoked = true
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(main(page).getByRole("alert")).toContainText(
    "Team calendar access is required",
  )
  await expect(
    day(page).getByText("Visible task", { exact: true }),
  ).toHaveCount(0)
  await expect(
    day(page).getByText("Calendar unavailable.", { exact: true }),
  ).toBeVisible()
  expect(reads.at(-1)).toBe("?scope=team&month=2030-02")
})

test("[PG-018-F001-A013-T001] project options deduplicate and sort locally and combine with event type without another request", async ({
  page,
}) => {
  let reads = 0
  await prepare(page, "STAFF", async (route) => {
    reads++
    await route.fulfill({
      json: payload(
        [
          event("Zulu meeting", { project: { id: "z", name: "Zulu" } }),
          event("Alpha meeting"),
          event("Alpha task", { type: "task", deadline: true }),
          event("No project", { project: null }),
        ],
        "STAFF",
      ),
    })
  })
  await page.goto("/calendar")
  await expect(day(page).getByRole("listitem")).toHaveCount(4)
  await main(page)
    .getByRole("combobox", { name: "Projects", exact: true })
    .click()
  await expect(page.getByRole("option")).toHaveText([
    "All projects",
    "Alpha",
    "Zulu",
  ])
  await page.getByRole("option", { name: "Alpha", exact: true }).click()
  await select(page, "Event types", "Task deadline")
  await expect(day(page).getByRole("listitem")).toHaveCount(1)
  await expect(day(page).getByText("Alpha task", { exact: true })).toBeVisible()
  expect(reads).toBe(1)
})

test("[PG-018-F001-A016-T001] deterministic filtered metrics and status badges report exact counts without assuming a KPI month contract", async ({
  page,
}) => {
  const events = [
    event("Overdue", {
      type: "task",
      deadline: true,
      startsAt: "2030-02-02T00:00:00Z",
      endsAt: null,
    }),
    event("Finished", {
      type: "task",
      deadline: true,
      completed: true,
      endsAt: null,
    }),
    event("Overlap one"),
    event("Overlap two"),
    event("Unassigned consultation", {
      type: "consultation",
      unassigned: true,
      staffMembers: [],
      startsAt: "2030-02-03T05:00:00Z",
      endsAt: "2030-02-03T06:00:00Z",
    }),
  ]
  await prepare(page, "ADMIN", (route) =>
    route.fulfill({ json: payload(events, "ADMIN") }),
  )
  await page.goto("/calendar")
  const metrics = main(page).getByRole("region", { name: "Schedule overview" })
  for (const [label, value] of [
    ["Scheduled events", "5"],
    ["Overdue tasks", "1"],
    ["Overlapping appointments", "2"],
    ["Unassigned consultations", "1"],
  ]) {
    await expect(
      metrics
        .getByRole("article")
        .filter({
          has: page.getByRole("heading", { name: label, exact: true }),
        })
        .locator(":scope > p")
        .first(),
    ).toHaveText(value)
  }
  await expect(day(page).getByText("Completed", { exact: true })).toHaveCount(1)
  await expect(
    day(page).getByText("Schedule overlap", { exact: true }),
  ).toHaveCount(2)
  await expect(day(page).getByText("Unassigned", { exact: true })).toHaveCount(
    1,
  )
  await main(page).locator('button[data-date="2030-02-02"]').click()
  await expect(
    main(page)
      .getByRole("region", { name: "Saturday, February 2" })
      .getByText("Overdue", { exact: true }),
  ).toHaveCount(2)
  await select(page, "Event types", "Meeting")
  for (const [label, value] of [
    ["Scheduled events", "2"],
    ["Overdue tasks", "0"],
    ["Overlapping appointments", "2"],
    ["Unassigned consultations", "0"],
  ])
    await expect(
      metrics
        .getByRole("article")
        .filter({
          has: page.getByRole("heading", { name: label, exact: true }),
        })
        .locator(":scope > p")
        .first(),
    ).toHaveText(value)
})
