import { expect, test } from "@playwright/test"
import type { Department } from "../../src/features/departments/api/departments-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

function departmentFixture(index: number): Department {
  const suffix = String(index).padStart(2, "0")
  const timestamp = "2026-01-01T00:00:00.000Z"
  return {
    id: `department-${suffix}`,
    name: `Department ${suffix}`,
    code: `CODE-${suffix}`,
    color: "teal",
    description: null,
    headId: null,
    head: null,
    memberCount: index,
    teamCount: index % 4,
    serviceCount: index % 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

test.describe("Department Management page regressions", () => {
  test("department directory filters by code, sorts by employee count, and resets pagination", async ({
    page,
  }) => {
    const departments = Array.from({ length: 12 }, (_, index) =>
      departmentFixture(index + 1),
    )
    await restoreSession(page, "ADMIN", { initialDepartments: departments })
    await page.goto("/departments")

    await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 12")
    await page
      .getByRole("navigation", { name: "Department pages" })
      .getByRole("button", { name: "Next page" })
      .click()
    await expect(page.getByRole("status")).toHaveText("Showing 11–12 of 12")
    await expect(
      page.getByRole("button", { name: "Department 11", exact: true }),
    ).toBeVisible()

    const search = page.getByRole("searchbox", {
      name: "Search departments",
    })
    await search.fill("CODE-12")
    await expect(page.getByRole("status")).toHaveText("Showing 1–1 of 1")
    await expect(
      page.getByRole("button", { name: "Department 12", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Department 11", exact: true }),
    ).toHaveCount(0)

    await search.clear()
    await page.getByRole("button", { name: "Sort by Employees" }).click()
    await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 12")
    await expect(page.getByRole("rowheader").first()).toContainText(
      "Department 12",
    )
  })

  test("department creation reports name boundaries and recovers from validation and uniqueness errors", async ({
    page,
  }) => {
    const departments: Department[] = []
    const createBodies: {
      name: string
      color: Department["color"]
      code?: string
      description?: string
      headId?: string | null
    }[] = []
    await restoreSession(page, "ADMIN", { initialDepartments: departments })
    await page.route("**/api/departments**", async (route) => {
      const request = route.request()
      const url = new URL(request.url())

      if (
        url.pathname === "/api/departments/eligible-heads" &&
        request.method() === "GET"
      ) {
        await route.fulfill({ json: { users: [] } })
        return
      }
      if (url.pathname === "/api/departments" && request.method() === "GET") {
        await route.fulfill({ json: { departments } })
        return
      }
      if (url.pathname === "/api/departments" && request.method() === "POST") {
        const body = request.postDataJSON() as {
          name: string
          color: Department["color"]
          code?: string
          description?: string
          headId?: string | null
        }
        createBodies.push(body)
        if (body.name.length < 2 || body.name.length > 80) {
          await route.fulfill({
            status: 400,
            json: {
              error: "Department name must be between 2 and 80 characters",
            },
          })
          return
        }
        if (
          body.name === "Operations" &&
          createBodies.filter((item) => item.name === "Operations").length === 1
        ) {
          await route.fulfill({
            status: 409,
            json: { error: "Department name or code already exists" },
          })
          return
        }

        const created: Department = {
          id: "department-created",
          name: body.name,
          code: body.code ?? null,
          color: body.color,
          description: body.description ?? null,
          headId: body.headId ?? null,
          head: null,
          memberCount: 0,
          teamCount: 0,
          serviceCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }
        departments.push(created)
        await route.fulfill({ status: 201, json: { department: created } })
        return
      }

      await route.fallback()
    })

    await page.goto("/departments")
    await page.getByRole("button", { name: "Create Department" }).click()
    const dialog = page.getByRole("dialog")
    const name = dialog.getByLabel("Department Name")
    const code = dialog.getByLabel("Department Code")
    const description = dialog.getByLabel("Description")
    const submit = dialog.getByRole("button", {
      name: "Create Department",
      exact: true,
    })

    await name.fill("   ")
    await submit.click()
    await expect(
      dialog.getByText("Please enter a department name", { exact: true }),
    ).toBeVisible()
    expect(createBodies).toHaveLength(0)

    await name.fill("A")
    const shortNamePost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await shortNamePost).postDataJSON()).toMatchObject({ name: "A" })
    await expect(
      dialog.getByText("Department name must be between 2 and 80 characters", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(name).toHaveValue("A")

    const longName = "N".repeat(81)
    await name.fill(longName)
    const longNamePost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await longNamePost).postDataJSON()).toMatchObject({
      name: longName,
    })
    await expect(
      dialog.getByText("Department name must be between 2 and 80 characters", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(name).toHaveValue(longName)

    await name.fill("  Operations  ")
    await code.fill(" ops ")
    await description.fill("  Coordinates internal teams  ")
    const firstPost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await firstPost).postDataJSON()).toMatchObject({
      name: "Operations",
      code: "OPS",
      description: "Coordinates internal teams",
    })
    await expect(createBodies).toHaveLength(3)
    await expect(
      dialog.getByText("Department name or code already exists", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(name).toHaveValue("  Operations  ")
    await expect(code).toHaveValue(" OPS ")

    await code.fill(" ops2 ")
    const retryPost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await retryPost).postDataJSON()).toMatchObject({
      name: "Operations",
      code: "OPS2",
      description: "Coordinates internal teams",
    })
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Operations", exact: true }),
    ).toBeVisible()
    expect(createBodies).toHaveLength(4)
  })
})
