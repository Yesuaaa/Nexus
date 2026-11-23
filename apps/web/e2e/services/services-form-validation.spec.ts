import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("service creation rejects whitespace-only names and recovers after correction", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/services")
  await page
    .getByRole("button", { name: "Create Service", exact: true })
    .click()

  const dialog = page.getByRole("dialog")
  const serviceWrites: string[] = []
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/services"
    ) {
      serviceWrites.push(request.url())
    }
  })

  await dialog.getByLabel("Service Name").fill("    ")
  await dialog
    .getByLabel("Description", { exact: false })
    .fill("A valid service description")
  await dialog.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(dialog.getByRole("alert")).toHaveText(
    "Service name must contain at least 2 characters",
  )
  expect(serviceWrites).toEqual([])

  await dialog.getByLabel("Service Name").fill("Consulting")
  await dialog
    .getByRole("button", { name: "Select responsible departments" })
    .click()
  await page.getByRole("menuitemcheckbox", { name: "Engineering" }).click()
  await page.keyboard.press("Escape")
  await dialog.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(
    dialog.getByRole("button", { name: "Add Benefit", exact: true }),
  ).toBeVisible()
  expect(serviceWrites).toEqual([])
})

test("service editing submits and retains a client requirement rejected by the API limit", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const requirement = "R".repeat(201)
  await page.route("**/api/services/service-1", (route) => {
    if (route.request().method() !== "PUT") return route.fallback()
    return route.fulfill({
      status: 400,
      json: {
        error:
          "Client requirements must contain up to 20 items of 200 characters each",
      },
    })
  })

  await page.goto("/services")
  await page
    .getByRole("button", {
      name: "More actions for Test Service",
      exact: true,
    })
    .click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()

  const dialog = page.getByRole("dialog")
  const selectStep = (name: string) =>
    dialog
      .getByRole("navigation", { name: "Service form progress" })
      .getByRole("button", { name })
      .click()
  await selectStep("Requirements")
  const requirements = dialog.getByRole("textbox", {
    name: /Client Requirements/,
  })
  await requirements.fill(requirement)
  const update = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      new URL(request.url()).pathname === "/api/services/service-1",
  )
  await selectStep("Pricing")
  await dialog.getByRole("button", { name: "Save Changes" }).click()
  expect((await update).postDataJSON()).toMatchObject({
    clientRequirements: [requirement],
  })
  await expect(dialog.getByRole("alert")).toHaveText(
    "Client requirements must contain up to 20 items of 200 characters each",
  )

  await selectStep("Requirements")
  await expect(requirements).toHaveValue(requirement)
})
