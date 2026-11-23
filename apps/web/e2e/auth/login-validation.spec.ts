import { expect, test } from "@playwright/test"
import { getAuthCopy } from "../../src/features/auth/content/auth-copy"
import { mockApi, storedTokens } from "../regression-support"

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
  await expect(password).toHaveAttribute("type", "password")
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
  const passwordBeforeVisibilityChange = await password.inputValue()
  await page.getByRole("button", { name: "Show password", exact: true }).click()
  await expect(password).toHaveAttribute("type", "text")
  await expect(password).toHaveValue(passwordBeforeVisibilityChange)
  await page.getByRole("button", { name: "Hide password", exact: true }).click()
  await expect(password).toHaveAttribute("type", "password")
  await expect(password).toHaveValue(passwordBeforeVisibilityChange)
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

test("login Enter submission preserves the password and ignores unsafe redirects", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let loginRequests = 0
  let requestMatches = false
  await page.route("**/api/auth/login", async (route) => {
    loginRequests += 1
    const body = route.request().postDataJSON() as {
      email?: string
      password?: string
    }
    requestMatches =
      body.email === "keyboard-login@example.org" &&
      body.password === "  SyntheticPassword123!  "
    await route.fallback()
  })

  await page.goto("/login?next=https://example.org&role=SUPERADMIN")
  await page
    .getByLabel("Email address", { exact: true })
    .fill("keyboard-login@example.org")
  const password = page.getByLabel("Password", { exact: true })
  await password.fill("  SyntheticPassword123!  ")
  await password.press("Enter")

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(loginRequests).toBe(1)
  expect(requestMatches).toBe(true)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("a network failure retains credentials and permits a successful retry", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let attempts = 0
  await page.route("**/api/auth/login", async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.abort("failed")
      return
    }
    await route.fallback()
  })

  await page.goto("/login")
  const email = page.getByLabel("Email address", { exact: true })
  const password = page.getByLabel("Password", { exact: true })
  const submit = page.getByRole("button", { name: "Sign In", exact: true })
  await email.fill("network-retry@example.org")
  await password.fill("SyntheticPassword123!")
  await submit.click()

  await expect(page.getByText(getAuthCopy("en").networkError)).toBeVisible()
  await expect(email).toHaveValue("network-retry@example.org")
  await expect(password).toHaveValue("SyntheticPassword123!")
  await expect(submit).toBeEnabled()
  expect(await storedTokens(page)).toEqual([null, null])
  await expect(page).toHaveURL(/\/login$/)

  await submit.click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(attempts).toBe(2)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("a malformed successful login response cannot establish a session", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }))
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      json: { token: null, refreshToken: null, expiresIn: 900, user: null },
    }),
  )
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  )

  await page.goto("/login")
  await page
    .getByLabel("Email address", { exact: true })
    .fill("malformed-response@example.org")
  await page
    .getByLabel("Password", { exact: true })
    .fill("SyntheticPassword123!")
  await page.getByRole("button", { name: "Sign In", exact: true }).click()

  await expect(page).toHaveURL(/\/login$/)
  expect(await storedTokens(page)).toEqual([null, null])
})
