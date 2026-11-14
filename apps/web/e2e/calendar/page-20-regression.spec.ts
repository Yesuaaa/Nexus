import { expect, test, type Page } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"
import type { CalendarEvent } from "../../src/features/calendar/model/calendar"

configureRegressionTest()

function event(
  id: string,
  type: CalendarEvent["type"],
  title: string,
  startsAt: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    type,
    title,
    context: "Page 20 test event",
    startsAt,
    endsAt: null,
    location: null,
    staff: null,
    pending: false,
    href: null,
    completed: false,
    deadline: false,
    unassigned: false,
    staffMembers: [],
    department: null,
    project: null,
    ...overrides,
  }
}

async function openUserCalendar(
  page: Page,
  time: string,
  events: CalendarEvent[],
) {
  await page.clock.install({ time: new Date(time) })
  await restoreSession(page, "USER")
  await page.route("**/api/projects/calendar", (route) =>
    route.fulfill({ json: events }),
  )
  await page.goto("/calendar")
  return page.getByRole("main", { name: "Your calendar" })
}

test("[P20-WEB-001] Manila calendar dates remain correct across leap-day midnight", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const beforeMidnight = event(
    "p20-before-midnight",
    "consultation",
    "Before leap-day midnight",
    "2032-02-29T15:45:00.000Z",
    {
      endsAt: "2032-02-29T16:15:00.000Z",
      location: "Online",
      staff: "Department head",
    },
  )
  const afterMidnight = event(
    "p20-after-midnight",
    "consultation",
    "After leap-day midnight",
    "2032-02-29T16:30:00.000Z",
    {
      endsAt: "2032-02-29T17:30:00.000Z",
      location: "Online",
      staff: "Department head",
    },
  )
  const main = await openUserCalendar(page, "2032-02-29T16:00:00.000Z", [
    beforeMidnight,
    afterMidnight,
  ])

  await expect(main.getByRole("heading", { name: "Calendar" })).toBeVisible()
  await expect(main.getByRole("grid", { name: "March 2032" })).toBeVisible()
  let day = main.getByRole("region", { name: "Monday, March 1" })
  await expect(
    day.getByText("After leap-day midnight", { exact: true }),
  ).toBeVisible()
  await expect(
    day.getByText("Before leap-day midnight", { exact: true }),
  ).toHaveCount(0)

  await page.screenshot({
    path: testInfo.outputPath("page-20-leap-day-calendar-mobile.png"),
    fullPage: true,
  })
  await main.getByRole("button", { name: "Previous month" }).click()
  const leapDay = main
    .getByRole("grid", { name: "February 2032" })
    .getByRole("button", { name: /Sunday, February 29, 2032/ })
  await expect(leapDay).toBeVisible()
  await expect(leapDay).toContainText("29")
  await leapDay.click()

  day = main.getByRole("region", { name: "Sunday, February 29" })
  await expect(
    day.getByText("Before leap-day midnight", { exact: true }),
  ).toBeVisible()
  await expect(
    day.getByText("After leap-day midnight", { exact: true }),
  ).toHaveCount(0)
  await expect(day.getByText(/11:45/)).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("[P20-WEB-002] keyboard calendar navigation crosses the year boundary", async ({
  page,
}) => {
  const main = await openUserCalendar(page, "2030-12-31T16:00:00.000Z", [])
  let grid = main.getByRole("grid", { name: "January 2031" })
  await expect(
    grid.getByRole("button", { name: "Wednesday, January 1, 2031" }),
  ).toBeVisible()

  const newYear = grid.getByRole("button", {
    name: "Wednesday, January 1, 2031",
  })
  await newYear.focus()
  await page.keyboard.press("PageUp")

  grid = main.getByRole("grid", { name: "December 2030" })
  const firstOfDecember = grid.getByRole("button", {
    name: "Sunday, December 1, 2030",
  })
  await expect(firstOfDecember).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(
    main.getByRole("region", { name: "Sunday, December 1" }),
  ).toBeVisible()
})

test("[P20-WEB-003] failed calendar reads retry without losing the selected date", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2032-02-29T16:00:00.000Z") })
  await restoreSession(page, "USER")
  let reads = 0
  const recoveredEvent = event(
    "p20-recovered-consultation",
    "consultation",
    "Recovered calendar consultation",
    "2032-02-29T16:30:00.000Z",
    { endsAt: "2032-02-29T17:00:00.000Z" },
  )
  await page.route("**/api/projects/calendar", (route) => {
    reads += 1
    return reads === 1
      ? route.fulfill({ status: 500, json: { error: "Calendar read failed" } })
      : route.fulfill({ json: [recoveredEvent] })
  })
  await page.goto("/calendar")

  const main = page.getByRole("main", { name: "Your calendar" })
  await expect(main.getByRole("alert")).toBeVisible()
  const day = main.getByRole("region", { name: "Monday, March 1" })
  await expect(
    day.getByText("Calendar unavailable.", { exact: true }),
  ).toBeVisible()
  await main.getByRole("button", { name: "Try again" }).click()

  await expect(
    day.getByText("Recovered calendar consultation", { exact: true }),
  ).toBeVisible()
  expect(reads).toBe(2)
  await expect(main.getByRole("button", { name: "Try again" })).toHaveCount(0)
})

test("[P20-WEB-004] meeting join links require HTTPS without embedded credentials", async ({
  page,
}) => {
  const time = "2030-02-03T10:00:00.000Z"
  const unsafeProtocol = event(
    "p20-unsafe-protocol",
    "meeting",
    "Unsafe protocol meeting",
    "2030-02-03T10:05:00.000Z",
    {
      endsAt: "2030-02-03T11:00:00.000Z",
      location: "javascript:alert(1)",
    },
  )
  const embeddedCredentials = event(
    "p20-embedded-credentials",
    "meeting",
    "Credential URL meeting",
    "2030-02-03T10:07:00.000Z",
    {
      endsAt: "2030-02-03T11:00:00.000Z",
      location: "https://user:secret@meet.example.test/room",
    },
  )
  const safeMeeting = event(
    "p20-safe-meeting",
    "meeting",
    "Safe HTTPS meeting",
    "2030-02-03T10:10:00.000Z",
    {
      endsAt: "2030-02-03T11:00:00.000Z",
      location: "https://meet.example.test/room",
    },
  )
  const main = await openUserCalendar(page, time, [
    unsafeProtocol,
    embeddedCredentials,
    safeMeeting,
  ])
  const day = main.getByRole("region", { name: "Sunday, February 3" })
  const join = day.getByRole("link", { name: "Join meeting", exact: true })

  await expect(join).toHaveCount(1)
  await expect(join).toHaveAttribute("href", "https://meet.example.test/room")
  await expect(join).toHaveAttribute("target", "_blank")
  await expect(join).toHaveAttribute("rel", "noopener noreferrer")
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
})
