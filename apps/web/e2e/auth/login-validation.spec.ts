import { expect, test } from "@playwright/test"
import { getAuthCopy } from "../../src/features/auth/content/auth-copy"

test("login validates both fields, preserves credentials, and prevents duplicate requests", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  let requests = 0
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/auth/login", async (route) => {
    requests += 1
    expect(route.request().postDataJSON()).toEqual({
      email: "User+tag@example.org",
      password: "  密碼🔒'<>  ",
    })
    await held
    await route.fulfill({
      status: 401,
      json: { error: "Invalid email or password" },
    })
  })
  await page.goto(
    "/login?next=https://example.org&email=attacker@example.com&role=SUPERADMIN",
  )
  const email = page.locator("#email")
  const password = page.locator("#password")
  const submit = page.locator('button[type="submit"]')
  await expect(page.locator("input")).toHaveCount(2)
  await expect(email).toHaveValue("")
  await submit.click()
  await expect(email).toBeFocused()
  await expect(email).toHaveAttribute("aria-invalid", "true")
  for (const value of ["   ", "invalid", "a@@b.com", "a b@example.com"]) {
    await email.fill(value)
    await submit.click()
    await expect(email).toHaveAttribute("aria-invalid", "true")
  }
  await email.fill("a".repeat(300))
  await expect(email).toHaveValue("a".repeat(254))
  await email.fill("User+tag@example.org")
  await submit.click()
  await expect(password).toBeFocused()
  await expect(password).toHaveAttribute("aria-invalid", "true")
  await password.fill("🔒".repeat(257))
  await submit.click()
  await expect(password).toHaveAttribute("aria-invalid", "true")
  expect(requests).toBe(0)
  await password.fill("  密碼🔒'<>  ")
  await page.getByRole("button", { name: "Show password", exact: true }).click()
  await expect(password).toHaveAttribute("type", "text")
  await page.getByRole("button", { name: "Hide password", exact: true }).click()
  await expect(password).toHaveAttribute("type", "password")
  await page.locator("form").evaluate((form) => {
    for (let index = 0; index < 10; index += 1)
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      )
  })
  await expect(submit).toBeDisabled()
  await expect.poll(() => requests).toBe(1)
  release()
  await expect(submit).toBeEnabled()
  await expect(
    page.getByText("Email or password is incorrect. Please try again.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/login")
})

test("language selection is bounded, keyboard accessible, and localizes validation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("exp-auth-language"))
      localStorage.setItem("exp-auth-language", "invalid")
  })
  await page.goto("/login")
  const trigger = page.getByRole("button", { name: "Language: English" })
  await trigger.focus()
  await trigger.press("ArrowDown")
  await expect(page.getByRole("menuitemradio")).toHaveCount(2)
  await page.getByRole("menuitemradio", { name: "English" }).press("End")
  await page.getByRole("menuitemradio", { name: "Filipino" }).press("Enter")
  await page.locator('button[type="submit"]').click()
  await expect(page.locator("#email-error")).toHaveText(
    getAuthCopy("fil").emailRequired,
  )
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true")
  await page.reload()
  await expect(page.getByRole("button", { name: /Filipino/ })).toBeVisible()
})
