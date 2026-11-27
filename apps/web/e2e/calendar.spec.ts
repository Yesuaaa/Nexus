import { expect, test } from "@playwright/test"
import { accountFor, configureRegressionTest } from "./regression-support"
import type { CalendarEvent } from "../src/features/calendar/model/calendar"

configureRegressionTest()

const task: CalendarEvent = {
  id: "own-task",
  type: "task",
  title: "Prepare designs",
  context: "Brand project",
  startsAt: "2030-02-02T16:00:00.000Z",
  endsAt: null,
  location: null,
  staff: "Staff",
  pending: false,
  href: "/project-workspace/ungrouped-project%3Aproject-1",
  completed: false,
  deadline: true,
  project: { id: "project-1", name: "Brand project" },
  department: { id: "design", name: "Design" },
  staffMembers: [{ id: "actor", name: "Staff" }],
}

for (const role of ["STAFF", "ADMIN", "SUPERADMIN", "USER"] as const) {
  for (const width of [1440, 390]) {
    test(`${role} calendar supports its role-specific view at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.clock.install({ time: new Date("2030-02-03T02:00:00Z") })
      await page.addInitScript(() =>
        sessionStorage.setItem("nexus.auth.token", "test-session"),
      )
      const calendarReads: string[] = []
      const writes: string[] = []
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname.startsWith("/api/") &&
          !["GET", "HEAD"].includes(request.method())
        )
          writes.push(request.method() + " " + new URL(request.url()).pathname)
      })
      let additionalEvents: CalendarEvent[] = []
      await page.route("**/api/**", async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname === "/api/auth/me")
          return route.fulfill({ json: { user: accountFor(role) } })
        if (url.pathname === "/api/projects/calendar") {
          calendarReads.push(url.search)
          if (role === "USER")
            return route.fulfill({
              json: [
                ...additionalEvents,
                {
                  ...task,
                  type: "milestone",
                  deadline: false,
                  title: "Shared deliverable",
                  href: "/projects/project-1",
                },
              ],
            })
          const team = {
            ...task,
            id: "team-task",
            title: "Team deadline",
            staffMembers: [{ id: "teammate", name: "Teammate" }],
          }
          return route.fulfill({
            json: {
              events:
                url.searchParams.get("scope") === "team"
                  ? [task, team, ...additionalEvents]
                  : [
                      { ...task, href: role === "STAFF" ? task.href : null },
                      ...additionalEvents,
                    ],
              canViewTeam: role === "STAFF",
              organization: role !== "STAFF",
            },
          })
        }
        return route.fulfill({
          json: {
            notifications: [],
            unreadCount: 0,
            conversations: [],
            groups: [],
            workspaces: [],
            canCreate: false,
          },
        })
      })
      await page.goto("/calendar")
      const main = page.getByRole("main", { name: "Your calendar" })
      await expect(
        main.getByRole("heading", { name: "Calendar", exact: true }),
      ).toBeVisible()
      await expect(main.getByRole("grid")).toBeVisible()
      const day = main.getByRole("region", { name: "Sunday, February 3" })
      await expect(
        day.getByText(
          role === "USER" ? "Shared deliverable" : "Prepare designs",
          { exact: true },
        ),
      ).toBeVisible()
      if (role === "USER") {
        await expect(
          main.getByRole("link", { name: "Book a consultation" }),
        ).toBeVisible()
        await expect(
          main.getByRole("region", { name: "Calendar filters" }),
        ).toHaveCount(0)
      } else {
        await expect(
          main.getByRole("link", { name: "Book a consultation" }),
        ).toHaveCount(0)
        if (role === "STAFF") {
          await main.getByRole("combobox", { name: "Calendar scope" }).click()
          await page
            .getByRole("option", { name: "My team", exact: true })
            .click()
          await expect(
            day.getByText("Team deadline", { exact: true }),
          ).toBeVisible()
          await expect(
            day.getByRole("link", { name: "View Prepare designs" }),
          ).toHaveAttribute(
            "href",
            "/project-workspace/ungrouped-project%3Aproject-1",
          )
        } else {
          await expect(
            day.getByRole("link", { name: "View Prepare designs" }),
          ).toHaveCount(0)
          await expect(
            main.getByRole("combobox", { name: "Departments" }),
          ).toBeVisible()
          await main
            .getByRole("combobox", { name: "Staff", exact: true })
            .click()
          await page.getByRole("option", { name: "Staff", exact: true }).click()
          await expect(
            day.getByText("Prepare designs", { exact: true }),
          ).toBeVisible()
        }
        await main.getByRole("combobox", { name: "Event types" }).click()
        await page.getByRole("option", { name: "Meeting", exact: true }).click()
        await expect(day.getByText("No events on this day")).toBeVisible()
        await main.getByRole("button", { name: "Clear filters" }).click()
        await expect(
          day.getByText("Prepare designs", { exact: true }),
        ).toBeVisible()
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      // PG-018-F001-A005-T001: preserve the chosen day across view changes.
      await main.getByRole("button", { name: "Previous month" }).click()
      await expect(
        main.getByRole("grid", { name: "January 2030" }),
      ).toBeVisible()
      await main.getByRole("button", { name: "Previous month" }).click()
      await expect(
        main.getByRole("grid", { name: "December 2029" }),
      ).toBeVisible()
      await expect(day).toBeVisible()
      await main.getByRole("button", { name: "Next month" }).click()
      await expect(
        main.getByRole("grid", { name: "January 2030" }),
      ).toBeVisible()
      await main.getByRole("button", { name: "Today", exact: true }).click()
      await expect(
        main.getByRole("grid", { name: "February 2030" }),
      ).toBeVisible()
      if (role === "USER")
        expect(calendarReads.every((query) => query === "")).toBe(true)
      else
        await expect
          .poll(() => calendarReads)
          .toEqual(
            expect.arrayContaining([
              "?scope=" +
                (role === "STAFF" ? "team" : "mine") +
                "&month=2029-12",
              "?scope=" +
                (role === "STAFF" ? "team" : "mine") +
                "&month=2030-02",
            ]),
          )
      if (role === "ADMIN" || role === "SUPERADMIN") {
        // PG-018-F001-A014-T001: department and staff are an AND, not a union.
        additionalEvents = [
          {
            ...task,
            id: "other-dept",
            title: "Other department task",
            department: { id: "other", name: "Other" },
            staffMembers: [{ id: "actor", name: "Staff" }],
            href: null,
          },
          {
            ...task,
            id: "other-staff",
            title: "Other staff task",
            staffMembers: [{ id: "other-actor", name: "Other staff" }],
            href: null,
          },
        ]
        await page.evaluate(() => window.dispatchEvent(new Event("focus")))
        await expect(
          day.getByText("Other department task", { exact: true }),
        ).toBeVisible()
        await main
          .getByRole("combobox", { name: "Departments", exact: true })
          .click()
        await page.getByRole("option", { name: "Design", exact: true }).click()
        await main.getByRole("combobox", { name: "Staff", exact: true }).click()
        await page.getByRole("option", { name: "Staff", exact: true }).click()
        await expect(
          day.getByText("Prepare designs", { exact: true }),
        ).toBeVisible()
        await expect(
          day.getByText("Other department task", { exact: true }),
        ).toHaveCount(0)
        await expect(
          day.getByText("Other staff task", { exact: true }),
        ).toHaveCount(0)
      }
      if (role !== "USER") {
        // PG-018-F001-A015-T001: clear all four filters, retain scope/day.
        await main
          .getByRole("combobox", { name: "Projects", exact: true })
          .click()
        await page
          .getByRole("option", { name: "Brand project", exact: true })
          .click()
        await main
          .getByRole("combobox", { name: "Event types", exact: true })
          .click()
        await page
          .getByRole("option", { name: "Task deadline", exact: true })
          .click()
        const readsBeforeClear = calendarReads.length
        await main.getByRole("button", { name: "Clear filters" }).click()
        for (const [label, value] of [
          ["Event types", "All event types"],
          ["Projects", "All projects"],
          ...(role === "STAFF"
            ? []
            : [
                ["Departments", "All departments"],
                ["Staff", "All staff"],
              ]),
        ])
          await expect(
            main.getByRole("combobox", { name: label, exact: true }),
          ).toContainText(value)
        if (role === "STAFF")
          await expect(
            main.getByRole("combobox", { name: "Calendar scope" }),
          ).toContainText("My team")
        await expect(day).toBeVisible()
        expect(calendarReads.length).toBe(readsBeforeClear)
      }
      // PG-018-F001-A010-T001: keyboard navigation follows encoded source href.
      if (role === "USER" || role === "STAFF") {
        const destination =
          role === "USER"
            ? "/projects/project-1"
            : "/project-workspace/ungrouped-project%3Aproject-1"
        await page.route(
          (url) => url.pathname === destination || url.pathname === "/services",
          (route) =>
            route.fulfill({
              contentType: "text/html",
              body: "<!doctype html><html><body><main>Calendar navigation destination fixture</main></body></html>",
            }),
        )
        const link = day.getByRole("link", {
          name:
            role === "USER"
              ? "View Shared deliverable"
              : "View Prepare designs",
        })
        await link.focus()
        await expect(link).toBeFocused()
        await page.keyboard.press("Enter")
        await expect(page).toHaveURL(
          new RegExp(destination.replaceAll("?", "\\?")),
        )
        if (role === "USER") {
          await page.goto("/calendar")
          const book = main.getByRole("link", { name: "Book a consultation" })
          await book.focus()
          await page.keyboard.press("Enter")
          await expect(page).toHaveURL(/\/services$/)
        }
      }
      expect(writes).toEqual([])
    })
  }
}
