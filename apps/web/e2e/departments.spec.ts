import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Department management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  test("department head status changes are blocked without an eligible replacement", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.route("**/api/employees/employee-1/status-options", (route) =>
      route.fulfill({
        json: {
          isDepartmentHead: true,
          replacementCandidates: [],
          recommendedReplacementEmployeeId: null,
          willRestoreOriginalHead: false,
        },
      }),
    )
    await page.goto("/employees")
    await page
      .getByRole("button", { name: "More actions for Alex Employee" })
      .click()
    await page.getByRole("menuitem", { name: "Change status" }).click()
    await page.getByRole("combobox", { name: "Status", exact: true }).click()
    await page.getByRole("option", { name: "On leave", exact: false }).click()
    await expect(
      page.getByText(
        "No active Staff member with an EXP account is available.",
        {
          exact: false,
        },
      ),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Confirm status" }),
    ).toBeDisabled()
  })

  test("department team creation reports authorization errors without adding a team", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
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
    const request = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/dept-1/teams"),
    )
    await page.getByRole("button", { name: "Save team" }).click()
    expect((await request).postDataJSON()).toMatchObject({
      name: "Restricted Team",
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
