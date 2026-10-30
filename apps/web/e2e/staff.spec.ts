import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Staff and role navigation", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
    test(`${role} restores its layout, navigation, and deep-link permissions`, async ({
      page,
    }) => {
      await restoreSession(page, role)
      await page.goto("/")
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.locator(`[data-role="${role}"]`)).toBeVisible()
      const menu = page.getByRole("navigation", { name: "Main menu" })
      const managesAccounts = role === "SUPERADMIN"
      await expect(
        menu.getByRole("link", { name: "Account Management", exact: true }),
      ).toHaveCount(managesAccounts ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Department Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Employee Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Service Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Services", exact: true }),
      ).toHaveCount(role === "USER" ? 1 : 0)

      await page.goto("/accounts")
      if (managesAccounts) {
        await expect(
          page.getByRole("heading", { name: "Account Management" }),
        ).toBeVisible()
        await expect(
          page.getByText("Test Person", { exact: true }),
        ).toBeVisible()
        await expect(
          menu.getByRole("link", { name: "Account Management", exact: true }),
        ).toHaveAttribute("aria-current", "page")
      } else {
        await expect(page).toHaveURL(/\/dashboard$/)
      }

      const departmentRequests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/departments")) {
          departmentRequests.push(request.url())
        }
      })
      await page.goto("/departments")
      if (role !== "ADMIN") {
        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
          page.getByRole("heading", { name: "Department Management" }),
        ).toHaveCount(0)
        expect(departmentRequests).toEqual([])
      } else {
        await expect(
          page.getByRole("heading", { name: "Department Management" }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Create Department", exact: true }),
        ).toHaveCount(1)
        await page.reload()
        await expect(
          page.getByRole("heading", { name: "Department Management" }),
        ).toBeVisible()
      }

      const employeeRequests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/employees")) {
          employeeRequests.push(request.url())
        }
      })
      await page.goto("/employees")
      if (role !== "ADMIN") {
        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
          page.getByRole("heading", { name: "Employee Management" }),
        ).toHaveCount(0)
        expect(employeeRequests).toEqual([])
      } else {
        await expect(
          page.getByRole("heading", { name: "Employee Management" }),
        ).toBeVisible()
        await expect(
          page.getByText("Alex Employee", { exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Create Employee", exact: true }),
        ).toHaveCount(1)
        expect(employeeRequests).toHaveLength(1)
      }

      const serviceRequests: string[] = []
      page.on("request", (request) => {
        if (
          /^\/api\/(services|client\/services)/.test(
            new URL(request.url()).pathname,
          )
        ) {
          serviceRequests.push(request.url())
        }
      })
      await page.goto("/services")
      if (role === "SUPERADMIN" || role === "STAFF") {
        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toHaveCount(0)
        expect(serviceRequests).toEqual([])
      } else if (role === "ADMIN") {
        await expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toBeVisible()
        await expect(
          page.getByText("Test Service", { exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Create Service", exact: true }),
        ).toHaveCount(1)
        expect(
          serviceRequests.map((url) => new URL(url).pathname).sort(),
        ).toEqual(["/api/services", "/api/services/pricing-templates"])
        await page.reload()
        await expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toBeVisible()
      } else {
        await expect(
          page.getByRole("heading", { name: "Build Your Brand with EXP" }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Explore Test Service" }),
        ).toBeVisible()
        expect(serviceRequests.map((url) => new URL(url).pathname)).toEqual([
          "/api/client/services",
        ])
      }
    })
  }
})
