import { expect, test, type Page } from "@playwright/test"
import { getAuthCopy } from "../../src/features/auth/content/auth-copy"
import { mockApi, restoreSession, storedTokens } from "../regression-support"

const path = "/internal/login"
const credentials = {
  email: "workforce@example.test",
  password: "  Synthetic123!  ",
}
const email = (page: Page) => page.locator("#email")
const password = (page: Page) => page.locator("#password")
const submit = (page: Page) => page.locator('button[type="submit"]')
const heading = (page: Page) =>
  page.getByRole("heading", { name: "Sign in to Team Portal" })
const copy = getAuthCopy("en")

async function fill(page: Page) {
  await email(page).fill(credentials.email)
  await password(page).fill(credentials.password)
}

test("PG-026-F004-A001-T004 validates and locks workforce submission", async ({
  page,
}) => {
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let attempts = 0
  const matchingBodies: boolean[] = []
  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    matchingBodies.push(
      Object.keys(body).sort().join(",") === "email,password" &&
        body.email === credentials.email &&
        body.password === credentials.password,
    )
    attempts++
    if (attempts === 1) {
      await held
      await route.fulfill({
        status: 401,
        json: { error: "Invalid credentials" },
      })
    } else if (attempts === 2) await route.abort()
    else await route.fulfill({ status: 429, json: { error: "Rate limited" } })
  })
  await page.goto(path)
  await submit(page).click()
  await expect(email(page)).toBeFocused()
  await expect(email(page)).toHaveAttribute("aria-invalid", "true")
  await email(page).fill("invalid")
  await submit(page).click()
  await expect(email(page)).toHaveAttribute("aria-invalid", "true")
  await email(page).fill(credentials.email)
  await submit(page).click()
  await expect(password(page)).toBeFocused()
  await expect(password(page)).toHaveAttribute("aria-invalid", "true")
  expect(attempts).toBe(0)
  await fill(page)
  try {
    await page.locator("form").evaluate((form) => {
      for (let i = 0; i < 5; i++)
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        )
    })
    await expect(submit(page)).toBeDisabled()
    await expect.poll(() => attempts).toBe(1)
  } finally {
    release()
  }
  await expect(
    page.getByText(copy.badCredentials, { exact: true }),
  ).toBeVisible()
  expect(attempts).toBe(1)
  await expect(submit(page)).toBeEnabled()
  await expect(email(page)).toHaveValue(credentials.email)
  expect((await password(page).inputValue()) === credentials.password).toBe(
    true,
  )
  await submit(page).click()
  await expect(page.getByText(copy.networkError, { exact: true })).toBeVisible()
  await expect(submit(page)).toBeEnabled()
  await submit(page).click()
  await expect(page.getByText(copy.rateLimited, { exact: true })).toBeVisible()
  await expect(submit(page)).toBeEnabled()
  expect(matchingBodies).toEqual([true, true, true])
  await expect(page).toHaveURL(/\/internal\/login$/)
  expect(await storedTokens(page)).toEqual([null, null])
})

test("PG-026-F005-A001-T005 keyboard password and language controls", async ({
  page,
}) => {
  await page.goto(path)
  await password(page).fill(credentials.password)
  await password(page).press("Tab")
  const reveal = page.getByRole("button", {
    name: "Show password",
    exact: true,
  })
  await expect(reveal).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(password(page)).toHaveAttribute("type", "text")
  expect((await password(page).inputValue()) === credentials.password).toBe(
    true,
  )
  await page.keyboard.press("Space")
  await expect(password(page)).toHaveAttribute("type", "password")
  expect((await password(page).inputValue()) === credentials.password).toBe(
    true,
  )
  const language = page.getByRole("button", { name: "Language: English" })
  await language.press("ArrowDown")
  await expect(page.getByRole("menuitemradio")).toHaveCount(2)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menuitemradio")).toHaveCount(0)
  await expect(language).toBeFocused()
  await language.press("ArrowDown")
  await page.getByRole("menuitemradio", { name: "English" }).press("End")
  await expect(
    page.getByRole("menuitemradio", { name: "Filipino" }),
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await submit(page).click()
  await expect(page.locator("#email-error")).toHaveText(
    getAuthCopy("fil").emailRequired,
  )
  await page.reload()
  await expect(page.getByRole("button", { name: /Filipino/ })).toBeVisible()
})

test("PG-026-F006-A001-T006 workforce controls remain reachable at form breakpoint", async ({
  page,
}, testInfo) => {
  await page.goto(path)
  for (const width of [419, 420, 421]) {
    await test.step(width + " CSS px", async () => {
      await page.setViewportSize({ width, height: 900 })
      await page.reload()
      await expect.soft(heading(page)).toBeVisible()
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true)
      const controls = {
        email: email(page),
        password: password(page),
        toggle: page.getByRole("button", { name: "Show password" }),
        language: page.getByRole("button", { name: "Language: English" }),
        submit: submit(page),
        client: page.getByRole("link").and(page.locator('a[href="/login"]')),
      }
      for (const control of Object.values(controls))
        await expect.soft(control).toBeVisible()
      const reached = new Set<string>()
      for (let i = 0; i < 16 && reached.size < 6; i++) {
        await page.keyboard.press("Tab")
        for (const [key, control] of Object.entries(controls)) {
          if (
            await control.evaluateAll((nodes) =>
              nodes.some((node) => node === document.activeElement),
            )
          )
            reached.add(key)
        }
      }
      expect.soft([...reached].sort()).toEqual(Object.keys(controls).sort())
      const padding = await page
        .locator(".auth-form-enter")
        .evaluate((node) => getComputedStyle(node).paddingLeft)
      testInfo.annotations.push({
        type: "form padding",
        description: width + ": " + padding,
      })
    })
  }
})

test("PG-026-F008-A001-T008 wrong portal clears local credentials when logout fails", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let attempted = false
  await page.route("**/api/auth/logout", async (route) => {
    attempted = route.request().method() === "POST"
    await route.fulfill({
      status: 503,
      json: { error: "Synthetic logout unavailable" },
    })
  })
  await page.goto(path)
  const destinations: string[] = []
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname !== path)
      destinations.push(new URL(frame.url()).pathname)
  })
  await fill(page)
  await submit(page).click()
  await expect
    .soft(page.getByText(copy.workforceAccountRequired, { exact: true }))
    .toBeVisible()
  await expect.soft(submit(page)).toBeEnabled()
  expect.soft(attempted).toBe(true)
  expect.soft(await storedTokens(page)).toEqual([null, null])
  expect(destinations).toEqual([])
})

test("PG-026-F009-A001-T009 checks existing session recovery and invalidation", async ({
  page,
  browser,
  baseURL,
}) => {
  await restoreSession(page, "ADMIN")
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let reads = 0
  let logins = 0
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/auth/login") logins++
  })
  await page.route("**/api/auth/me", async (route) => {
    reads++
    if (reads !== 1) return route.fallback()
    await held
    await route.fulfill({
      status: 503,
      json: { error: "Synthetic account failure" },
    })
  })
  try {
    await page.goto(path)
    await expect(
      page.getByRole("status").filter({ hasText: "Checking your session" }),
    ).toBeVisible()
  } finally {
    release()
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "couldn't check your session",
  )
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page).toHaveURL(/\/module$/)
  expect(reads).toBeGreaterThanOrEqual(2)
  expect(logins).toBe(0)
  const context = await browser.newContext({ baseURL })
  try {
    const invalid = await context.newPage()
    await restoreSession(invalid, "ADMIN")
    await invalid.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 401, json: { error: "Invalid session" } }),
    )
    await invalid.goto(path)
    await expect(heading(invalid)).toBeVisible()
    await expect.poll(() => storedTokens(invalid)).toEqual([null, null])
    await expect(invalid).toHaveURL(/\/internal\/login$/)
  } finally {
    await context.close()
  }
})
