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
  href: "/project-workspace/project-1",
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
      await page.route("**/api/**", async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname === "/api/auth/me")
          return route.fulfill({ json: { user: accountFor(role) } })
        if (url.pathname === "/api/projects/calendar") {
          if (role === "USER")
            return route.fulfill({
              json: [
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
                  ? [task, team]
                  : [{ ...task, href: role === "STAFF" ? task.href : null }],
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
          ).toHaveAttribute("href", "/project-workspace/project-1")
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
    })
  }
}
