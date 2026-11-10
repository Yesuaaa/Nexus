import { expect, test } from "@playwright/test"
import { configureRegressionTest } from "../regression-support"

configureRegressionTest()

const invalidFields = [
  {
    field: "Contact number",
    value: "0912345678",
    error: "Enter 11 digits starting with 09 or 08.",
    password: "CorrectHorse123!",
    confirmation: "CorrectHorse123!",
  },
  {
    field: "Email address",
    value: "not-an-email",
    error: "Enter a valid email address, such as name@example.com.",
    password: "CorrectHorse123!",
    confirmation: "CorrectHorse123!",
  },
  {
    field: "Password",
    value: "short",
    error: "Use at least 12 characters for your password.",
    password: "short",
    confirmation: "short",
  },
  {
    field: "Confirm Password",
    value: "DifferentHorse123!",
    error: "Passwords do not match. Enter the same password.",
    password: "CorrectHorse123!",
    confirmation: "DifferentHorse123!",
  },
] as const

for (const scenario of invalidFields) {
  test(`[NEX-010] registration shows the ${scenario.field.toLowerCase()} error without submitting`, async ({
    page,
  }) => {
    let registrationRequests = 0
    await page.route("**/api/auth/register", async (route) => {
      registrationRequests += 1
      return route.fulfill({ status: 201, json: {} })
    })

    await page.goto("/register")
    await page.getByLabel("Full name", { exact: true }).fill("Taylor Tester")
    await page
      .getByLabel("Contact number", { exact: true })
      .fill(
        scenario.field === "Contact number" ? scenario.value : "09123456789",
      )
    await page
      .getByLabel("Email address", { exact: true })
      .fill(
        scenario.field === "Email address"
          ? scenario.value
          : "taylor@example.com",
      )
    await page.getByLabel("Password", { exact: true }).fill(scenario.password)
    await page
      .getByLabel("Confirm Password", { exact: true })
      .fill(scenario.confirmation)

    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click()

    await expect(page.getByText(scenario.error, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
    expect(registrationRequests).toBe(0)
  })
}
