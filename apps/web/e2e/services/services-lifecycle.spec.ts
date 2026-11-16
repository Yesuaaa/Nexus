import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("service status changes retain state after a rejected request and can be retried", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const statusWrites: { isActive: boolean }[] = []
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === "/api/services/service-1/status"
    ) {
      statusWrites.push(request.postDataJSON() as { isActive: boolean })
    }
  })
  await page.route(
    "**/api/services/service-1/status",
    (route) =>
      route.fulfill({
        status: 403,
        json: { error: "Permission revoked" },
      }),
    { times: 1 },
  )

  await page.goto("/services")
  await page
    .getByRole("button", {
      name: "More actions for Test Service",
      exact: true,
    })
    .click()
  await page
    .getByRole("menuitem", { name: "Deactivate service", exact: true })
    .click()

  const confirmation = page.getByRole("dialog")
  await confirmation
    .getByRole("button", { name: "Deactivate Service", exact: true })
    .click()
  await expect(confirmation.getByRole("alert")).toHaveText("Permission revoked")
  await expect(
    page.getByRole("row").filter({ hasText: "Test Service" }),
  ).toContainText("Active")

  await confirmation
    .getByRole("button", { name: "Deactivate Service", exact: true })
    .click()
  await expect(
    page.getByRole("row").filter({ hasText: "Test Service" }),
  ).toContainText("Inactive")
  await expect(confirmation).toHaveCount(0)
  expect(statusWrites).toEqual([{ isActive: false }, { isActive: false }])
})
