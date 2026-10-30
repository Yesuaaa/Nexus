import { expect, test } from "@playwright/test"
import type { Employee } from "../src/features/employees/api/employees-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Employee management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  test("employee search keeps the summary in sync with row motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    const employees: Employee[] = ["Alex Employee", "Second Employee"].map(
      (fullName, index) => ({
        id: `employee-${index + 1}`,
        employeeId: `EXP-00${index + 1}`,
        fullName,
        email: `employee${index}@example.com`,
        contactNumber: "09123456789",
        position: "Designer",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: "2026-01-15",
        departmentId: null,
        teamId: null,
        department: null,
        team: null,
        hasAccount: true,
        accountIsActive: true,
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      }),
    )
    await restoreSession(page, "ADMIN", { initialEmployees: employees })
    await page.goto("/employees")
    await expect(
      page.getByText("Showing 1–2 of 2", { exact: true }),
    ).toBeVisible()
    await page.evaluate(() => {
      const samples: { moving: boolean; summary: string }[] = []
      Reflect.set(window, "employeeMotionSamples", samples)
      const main = document.querySelector(
        'main[aria-label="Employee management"]',
      )!
      const observer = new MutationObserver(() => {
        samples.push({
          moving: Boolean(
            main.querySelector("[data-animated-slot-row][inert]"),
          ),
          summary: main.querySelector("footer")?.textContent ?? "",
        })
      })
      observer.observe(main, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      })
      Reflect.set(window, "employeeMotionObserver", observer)
    })
    await page
      .getByRole("searchbox", { name: "Search employees" })
      .fill("Second")
    await expect(
      page.getByText("Showing 1–1 of 1", { exact: true }),
    ).toBeVisible()
    const samples = await page.evaluate(() => {
      const observer = Reflect.get(
        window,
        "employeeMotionObserver",
      ) as MutationObserver
      observer.disconnect()
      return Reflect.get(window, "employeeMotionSamples") as {
        moving: boolean
        summary: string
      }[]
    })
    expect(
      samples.some(
        (sample) =>
          sample.moving && sample.summary.includes("Showing 1–2 of 2"),
      ),
    ).toBe(true)
    expect(
      samples.some(
        (sample) =>
          sample.moving && sample.summary.includes("Showing 1–1 of 1"),
      ),
    ).toBe(false)
    await expect(
      page.getByRole("row", { name: /Second Employee/ }),
    ).toBeVisible()
  })

  for (const width of [1440, 390]) {
    test(`employee row menus close the previous menu at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      const employees: Employee[] = ["Alex Employee", "Second Employee"].map(
        (fullName, index) => ({
          id: `employee-${index + 1}`,
          employeeId: `EXP-00${index + 1}`,
          fullName,
          email: `employee${index}@example.com`,
          contactNumber: "09123456789",
          position: "Designer",
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          startDate: "2026-01-15",
          departmentId: null,
          teamId: null,
          department: null,
          team: null,
          hasAccount: true,
          accountIsActive: true,
          createdAt: "2026-01-15T00:00:00Z",
          updatedAt: "2026-01-15T00:00:00Z",
        }),
      )
      await restoreSession(page, "ADMIN", { initialEmployees: employees })
      await page.goto("/employees")
      const first = page.getByRole("button", {
        name: "More actions for Alex Employee",
        exact: true,
      })
      const second = page.getByRole("button", {
        name: "More actions for Second Employee",
        exact: true,
      })
      await second.click()
      await expect(page.getByRole("menu")).toHaveCount(1)
      await expect(second).toHaveAttribute("aria-expanded", "true")
      await first.click()
      await expect(page.getByRole("menu")).toHaveCount(1)
      await expect(
        page.getByRole("menu", {
          name: "Actions for Alex Employee",
          exact: true,
        }),
      ).toBeVisible()
      await expect(first).toHaveAttribute("aria-expanded", "true")
      await expect(second).toHaveAttribute("aria-expanded", "false")
      await page.keyboard.press("Escape")
      await expect(page.getByRole("menu")).toHaveCount(0)
      await expect(first).toBeFocused()
    })
  }

  test("employee search, details, and login retirement controls preserve HR records", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/employees")
    await page.getByRole("button", { name: "View Alex Employee" }).click()
    await expect(page.getByRole("dialog")).toContainText("EMP-001")
    await expect(page.getByRole("dialog")).toContainText(
      "alex.employee@example.com",
    )
    await page.getByRole("button", { name: "Close employee details" }).click()
    await page
      .getByRole("button", { name: "More actions for Alex Employee" })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Deactivate account" }),
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await page.getByPlaceholder("Search name, ID, email…").fill("EMP-001")
    await expect(page.getByText("Alex Employee", { exact: true })).toBeVisible()
  })
})
