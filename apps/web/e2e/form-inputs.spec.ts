import { expect, test, type Locator } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Uses mocked accounts and profile writes")

// Tailwind's shadow-none can serialize as several transparent, zero-size layers.
const noVisibleShadow = /^(none|(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px,? ?)+)$/

async function expectBaseStyle(field: Locator, multiline = false) {
  await expect(field).toHaveCSS("font-size", "14px")
  await expect(field).toHaveCSS("font-weight", "400")
  await expect(field).toHaveCSS("line-height", "20px")
  await expect(field).toHaveCSS("border-radius", "8px")
  await expect(field).toHaveCSS("padding-left", "12px")
  await expect(field).toHaveCSS("outline-style", "none")
  await expect(field).toHaveCSS("box-shadow", noVisibleShadow)
  if (!multiline) await expect(field).toHaveCSS("height", "40px")
}

for (const width of [1440, 390]) {
  test(`account text and password fields share styling and error states at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await restoreSession(page, "SUPERADMIN")
    await page.goto("/accounts")
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    const email = dialog.locator('input[name="email"]')
    const password = dialog.locator('input[name="password"]')
    const name = dialog.locator('input[name="fullName"]')
    for (const field of [email, name, password]) await expectBaseStyle(field)

    await email.fill("invalid")
    await expect(email).toHaveCSS("border-color", "rgb(214, 69, 87)")
    await expect(email).toHaveCSS("box-shadow", noVisibleShadow)
    await email.fill("new@example.com")
    await expect(email).toHaveCSS("border-color", "rgb(154, 174, 203)")
    await name.fill("New Account")
    await password.fill("StrongPassword123!")
    await password.focus()
    await password.press("Tab")
    const toggle = dialog.getByRole("button", {
      name: "Show password",
      exact: true,
    })
    await expect(toggle).toBeFocused()
    await expect(password).toHaveCSS("border-color", "rgb(154, 174, 203)")
    await expect(toggle).toHaveCSS("outline-style", "none")
    await toggle.press("Space")
    await expect(password).toHaveAttribute("type", "text")
    await expect(password).toHaveValue("StrongPassword123!")
    await expectBaseStyle(password)
    await expect(dialog).toBeVisible()
  })

  test(`authentication uses the same border-only input focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/login")
    const email = page.locator("#email")
    const password = page.locator("#password")
    await expectBaseStyle(email)
    await expectBaseStyle(password)
    await email.fill("user@example.com")
    await email.focus()
    await expect(email).toHaveCSS("border-color", "rgb(154, 174, 203)")
    await expectBaseStyle(email)
    await password.fill("StrongPassword123!")
    await password.focus()
    await password.press("Tab")
    const toggle = page.getByRole("button", {
      name: "Show password",
      exact: true,
    })
    await expect(toggle).toBeFocused()
    await toggle.press("Space")
    await expect(password).toHaveAttribute("type", "text")
    await expectBaseStyle(password)
  })

  test(`service text and multiline fields share styling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Create Service", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    const name = dialog.getByLabel("Service Name")
    const description = dialog.getByLabel("Description", { exact: false })
    await expectBaseStyle(name)
    await expectBaseStyle(description, true)
    await description.fill("Service description")
    await description.focus()
    await expect(description).toHaveCSS("border-color", "rgb(154, 174, 203)")
    await expectBaseStyle(description, true)
  })
}

test("profile form read-only and pending fields retain shared states", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const profile = {
    user: accountFor("ADMIN"),
    employee: null,
    specialist: null,
  }
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/auth/profile", async (route) => {
    if (route.request().method() === "PATCH") await pending
    await route.fulfill({ json: profile })
  })
  await page.goto("/profile")
  await page
    .getByRole("button", { name: "Edit contact information", exact: true })
    .click()
  const dialog = page.getByRole("dialog")
  const email = dialog.getByLabel("Email address", { exact: false })
  await expect(email).toHaveAttribute("readonly", "")
  await expect(email).toHaveCSS("background-color", "rgb(245, 247, 250)")
  await expectBaseStyle(email)
  const name = dialog.getByLabel("Full name", { exact: true })
  await name.fill("Updated Person")
  await dialog.getByRole("button", { name: "Save personal details" }).click()
  try {
    await expect(name).toBeDisabled()
    await expect(name).toHaveCSS("background-color", "rgb(245, 247, 250)")
    await expect(name).toHaveCSS("opacity", "0.6")
    await expectBaseStyle(name)
  } finally {
    release()
  }
  await expect(dialog).toBeHidden()
})
