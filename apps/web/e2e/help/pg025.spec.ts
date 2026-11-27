import { expect, test, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  restoreSession,
  storedTokens,
} from "../regression-support"

configureRegressionTest()

const title = "Help & Support"
const first = "How do I book a service?"
const second = "What happens after I book a service?"
const main = (page: Page) => page.getByRole("main")
const search = (page: Page) =>
  main(page).getByRole("searchbox", { name: "Search questions" })
const question = (page: Page, name: string) =>
  main(page).getByRole("button", { name, exact: true })
const heading = (page: Page) =>
  main(page).getByRole("heading", { name: title, level: 1 })
async function openHelp(page: Page) {
  await restoreSession(page, "USER")
  await page.goto("/help")
  await expect(heading(page)).toBeVisible()
}

test("PG-025-F002-A001-T013 searches answer text and status labels", async ({
  page,
}) => {
  await openHelp(page)
  await search(page).fill("meeting link or location")
  await expect(main(page).getByRole("button")).toHaveText([
    "Where do I find my consultation details?",
  ])
  await expect(main(page).getByRole("region")).toHaveCount(1)
  await expect(
    main(page).getByRole("region", { name: "Quotations and consultations" }),
  ).toBeVisible()
  await search(page).fill("Pending")
  await expect(main(page).getByRole("button")).toHaveText([
    "What does my request status mean?",
  ])
  await expect(main(page).getByRole("region")).toHaveCount(1)
  await expect(
    main(page).getByRole("region", { name: "Bookings and requests" }),
  ).toBeVisible()
  await search(page).fill("   ")
  await expect(main(page).getByRole("region")).toHaveCount(2)
  await expect(main(page).getByRole("button")).toHaveCount(6)
})

test("PG-025-F003-A001-T014 preserves disclosure identity through filtering", async ({
  page,
}) => {
  await openHelp(page)
  await search(page).click()
  await page.keyboard.press("Tab")
  await expect(question(page, first)).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(question(page, first)).toHaveAttribute("aria-expanded", "false")
  await page.keyboard.press("Tab")
  await expect(question(page, second)).toBeFocused()
  await page.keyboard.press("Space")
  const inspect = () =>
    main(page)
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const id = button.getAttribute("aria-controls")
          return {
            id,
            expanded: button.getAttribute("aria-expanded"),
            hidden: id
              ? document.getElementById(id)?.getAttribute("aria-hidden")
              : null,
          }
        }),
      )
  await expect(question(page, second)).toHaveAttribute("aria-expanded", "true")
  const before = await inspect()
  expect(new Set(before.map((row) => row.id)).size).toBe(6)
  for (const row of before) {
    expect(row.id).toBeTruthy()
    expect(row.hidden).toBe(row.expanded === "true" ? "false" : "true")
  }
  await search(page).fill("quotation")
  await expect(question(page, second)).toHaveCount(0)
  await search(page).clear()
  await expect(question(page, second)).toHaveAttribute("aria-expanded", "true")
  expect(await inspect()).toEqual(before)
  await expect(main(page).locator('button[aria-expanded="true"]')).toHaveCount(
    1,
  )
  await question(page, second).click()
  await expect(main(page).locator('button[aria-expanded="true"]')).toHaveCount(
    0,
  )
})

test("PG-025-F009-A001-T015 treats search as local literal text", async ({
  page,
}, testInfo) => {
  await openHelp(page)
  const marker = "<span data-pg025-marker>FAQ marker</span>"
  const longMiss = "Z".repeat(256)
  const valid = "meeting link or location"
  const origin = new URL(page.url()).origin
  const requests: { url: string; body: string; method: string }[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).origin === origin)
      requests.push({
        url: request.url(),
        body: request.postData() ?? "",
        method: request.method(),
      })
  })
  await search(page).fill(marker)
  await expect.soft(main(page).getByRole("status")).toContainText(marker)
  await expect.soft(main(page).locator("[data-pg025-marker]")).toHaveCount(0)
  await search(page).fill(longMiss)
  await expect.soft(main(page).getByRole("status")).toContainText(longMiss)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  )
  testInfo.annotations.push({
    type: "characterization",
    description: "256-character miss document overflow: " + overflow,
  })
  await search(page).fill(valid)
  await expect
    .soft(main(page).getByRole("button"))
    .toHaveText(["Where do I find my consultation details?"])
  await expect.soft(main(page).getByRole("status")).toHaveCount(0)
  for (const request of requests) {
    const url = new URL(request.url)
    for (const input of [marker, longMiss, valid]) {
      expect.soft(decodeURIComponent(url.pathname)).not.toContain(input)
      expect.soft([...url.searchParams.values()].join(" ")).not.toContain(input)
      expect.soft(request.body).not.toContain(input)
    }
    const sharedAuth =
      url.pathname === "/api/auth/refresh" && request.method === "POST"
    expect
      .soft(
        sharedAuth || ["GET", "HEAD", "OPTIONS"].includes(request.method),
        request.method + " " + url.pathname,
      )
      .toBe(true)
  }
  await page.reload()
  await expect(search(page)).toHaveValue("")
  await expect(main(page).getByRole("button")).toHaveCount(6)
  await expect(question(page, first)).toHaveAttribute("aria-expanded", "true")
})

test("PG-025-F007-A001-T016 gates account settlement and clears revoked session", async ({
  page,
  browser,
  baseURL,
}) => {
  await restoreSession(page, "USER")
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let expired = false
  await page.route("**/api/auth/me", async (route) => {
    await gate
    if (expired)
      await route.fulfill({
        status: 401,
        json: { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      })
    else await route.fallback()
  })
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Revoked synthetic session" },
    }),
  )
  try {
    await page.goto("/help")
    await expect
      .soft(page.locator('main[role="status"]'))
      .toHaveText("Loading your account…")
    await expect.soft(search(page)).toHaveCount(0)
  } finally {
    release()
  }
  await expect(heading(page)).toBeVisible()
  expired = true
  const refresh = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/refresh" &&
      response.request().method() === "POST",
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event("nexus:account-updated")),
  )
  expect.soft((await refresh).status()).toBe(401)
  await expect.soft(page).toHaveURL(/\/login$/)
  expect.soft(await storedTokens(page)).toEqual([null, null])
  await expect.soft(search(page)).toHaveCount(0)
  const context = await browser.newContext({ baseURL })
  try {
    const fresh = await context.newPage()
    await openHelp(fresh)
    await expect(search(fresh)).toHaveValue("")
    await expect(main(fresh).getByRole("button")).toHaveCount(6)
    await expect(question(fresh, first)).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  } finally {
    await context.close()
  }
})

test("PG-025-F007-A001-T017 recovers Help after an initial account error", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let failed = true
  await page.route("**/api/auth/me", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { error: "Synthetic account failure" },
        })
      : route.fallback(),
  )
  await page.goto("/help")
  const alert = page
    .locator("main")
    .filter({ hasText: "Please refresh to try again." })
  await expect(alert).toHaveAttribute("role", "alert")
  await expect(alert).toContainText(
    "We couldn’t load your account. Please refresh to try again.",
  )
  await expect(search(page)).toHaveCount(0)
  failed = false
  await page.reload()
  await expect(heading(page)).toBeVisible()
  await expect(alert).toHaveCount(0)
  await expect(search(page)).toHaveValue("")
})

test("PG-025-F008-A001-T018 keeps Help controls reachable across lg", async ({
  page,
}) => {
  await openHelp(page)
  for (const [width, columns] of [
    [1023, 1],
    [1024, 2],
    [1025, 2],
  ]) {
    await test.step(width + " CSS px", async () => {
      await page.setViewportSize({ width, height: 900 })
      const grid = main(page).locator(":scope > div.grid")
      await expect.soft
        .poll(() =>
          grid.evaluate(
            (node) =>
              getComputedStyle(node).gridTemplateColumns.split(" ").length,
          ),
        )
        .toBe(columns)
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true)
      await expect.soft(search(page)).toBeVisible()
      await expect.soft(search(page)).toBeEnabled()
      const button = question(page, first)
      const before = await button.getAttribute("aria-expanded")
      await button.click()
      await expect
        .soft(button)
        .toHaveAttribute("aria-expanded", before === "true" ? "false" : "true")
      await expect
        .soft(main(page).getByRole("link", { name: "Open messages" }))
        .toBeVisible()
      await expect
        .soft(main(page).getByRole("link", { name: "support@exp.test" }))
        .toBeVisible()
    })
  }
})
