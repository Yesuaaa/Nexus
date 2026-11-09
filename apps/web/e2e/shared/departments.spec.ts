import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

test.describe("Department management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  test("employee account menu does not expose the retired employment status action", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/employees")
    await page
      .getByRole("button", { name: "More actions for Alex Employee" })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Deactivate account", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Change status", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", { name: "More actions for Alex Employee" }),
    ).toBeFocused()
  })

  test("department team creation reports authorization errors without adding a team", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.route("**/api/departments/dept-1", (route) =>
      route.fulfill({
        json: {
          department: {
            id: "dept-1",
            name: "Engineering",
            code: "ENG",
            color: "teal",
            description: null,
            headId: null,
            head: null,
            memberCount: 1,
            teamCount: 0,
            teams: [],
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            members: [
              {
                id: "employee-1",
                fullName: "Alex Employee",
                email: "alex@example.com",
                contactNumber: null,
                position: "Designer",
                status: "ACTIVE",
                teamId: null,
                team: null,
                userId: "staff-1",
                createdAt: "2026-01-01T00:00:00Z",
                user: {
                  id: "staff-1",
                  fullName: "Alex Employee",
                  email: "alex@example.com",
                  role: "STAFF",
                  isActive: true,
                  accountDeletedAt: null,
                },
              },
            ],
          },
        },
      }),
    )
    await page.route("**/api/departments/dept-1/teams", (route) =>
      route.fulfill({
        status: 403,
        json: { error: "Team permission revoked" },
      }),
    )
    await page.goto("/departments")
    await page.getByRole("button", { name: "Engineering", exact: true }).click()
    await page.getByRole("tab", { name: /Teams/ }).click()
    await page.getByRole("button", { name: "Create Team", exact: true }).click()
    await page.getByLabel("Team name").fill("Restricted Team")
    await expect(
      page.getByRole("button", { name: "Save team", exact: true }),
    ).toBeDisabled()
    await page
      .getByRole("list", { name: "Available team members" })
      .getByRole("button", { name: "Add", exact: true })
      .click()
    const request = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/dept-1/teams"),
    )
    await page.getByRole("button", { name: "Save team" }).click()
    expect((await request).postDataJSON()).toMatchObject({
      name: "Restricted Team",
      memberIds: ["employee-1"],
    })
    await expect(page.getByText("Team permission revoked")).toBeVisible()
    await expect(
      page.getByText("No teams created in this department yet."),
    ).toBeVisible()
  })

  test("admin can create, edit, delete departments and open member management", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/departments")

    await expect(
      page.getByRole("heading", { name: "Department Management" }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Engineering", exact: true }),
    ).toBeVisible()

    // 1. Create a Department
    await page
      .getByRole("button", { name: "Create Department", exact: true })
      .click()
    await expect(
      page.getByRole("heading", { name: "Create Department" }),
    ).toBeVisible()

    await page.getByLabel("Department Name").fill("Customer Support")
    await page.getByLabel("Department Code").fill("CS")
    await expect(
      page.getByRole("radiogroup", { name: "Department color" }),
    ).toBeVisible()
    await page.getByRole("radio", { name: "Green", exact: true }).click()
    const createdDepartment = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create Department" })
      .click()

    await expect(page.getByText("Customer Support")).toBeVisible()
    expect((await createdDepartment).postDataJSON()).toMatchObject({
      name: "Customer Support",
      color: "green",
    })
    await page.reload()

    // 2. Edit the Department
    await page.getByRole("button", { name: "Edit Customer Support" }).click()
    await expect(
      page.getByRole("heading", { name: "Edit Department" }),
    ).toBeVisible()
    await expect(
      page.getByRole("radio", { name: "Green", exact: true }),
    ).toBeChecked()
    await page.getByLabel("Department Name").fill("Client Success")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Update Department" })
      .click()

    await expect(page.getByText("Client Success")).toBeVisible()

    // 3. Open Member Management Sheet
    await page
      .getByRole("button", { name: "Client Success", exact: true })
      .click()

    // Member Management Drawer / Sheet opens
    await expect(
      page.getByRole("heading", { name: "Members & teams" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Close drawer" }).click()
    await expect(
      page.getByRole("heading", { name: "Members & teams" }),
    ).toHaveCount(0)

    // 4. Delete the Department
    await page
      .getByRole("button", { name: "More actions for Client Success" })
      .click()
    await page.getByRole("menuitem", { name: "Delete department" }).click()

    await expect(page.getByText("Delete department?")).toBeVisible()
    await page
      .getByRole("button", { name: "Delete department", exact: true })
      .click()

    await expect(page.getByText("Client Success")).toHaveCount(0)
  })
})
