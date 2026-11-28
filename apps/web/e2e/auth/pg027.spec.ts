import { expect, test, type Page } from "@playwright/test"
import { getAuthCopy } from "../../src/features/auth/content/auth-copy"
import { mockApi, restoreSession, storedTokens } from "../regression-support"

const service = "service-1"
const email = "pg027@example.test"
const password = "Synthetic client login 123!"
const path = "/login?service=" + service
const copy = getAuthCopy("en")
const emailField = (page: Page) =>
  page.getByLabel("Email address", { exact: true })
const passwordField = (page: Page) =>
  page.getByLabel("Password", { exact: true })
const submit = (page: Page) =>
  page.getByRole("button", { name: "Sign In", exact: true })
async function signIn(page: Page) {
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
  await submit(page).click()
}

test("PG-027-F006-A001-T006 preserves only service context across client sign-in", async ({
  page,
}) => {
  await mockApi(page, "USER")
  const writes: string[] = []
  const bodies: boolean[] = []
  page.on("request", (request) => {
    const p = new URL(request.url()).pathname
    if (
      p.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    )
      writes.push(request.method() + " " + p)
    if (p === "/api/auth/login" && request.method() === "POST") {
      const data = request.postDataJSON() as Record<string, unknown>
      bodies.push(
        Object.keys(data).sort().join(",") === "email,password" &&
          data.email === email &&
          data.password === password,
      )
    }
  })
  await page.goto(path + "&next=%2Fmodule")
  await expect(
    page.getByRole("link", { name: copy.createOne }),
  ).toHaveAttribute("href", "/register?service=" + service)
  await signIn(page)
  await expect(page).toHaveURL(/\/services\?service=service-1$/)
  expect([...new URL(page.url()).searchParams]).toEqual([["service", service]])
  expect(bodies).toEqual([true])
  expect(writes).toEqual(["POST /api/auth/login"])
})

test("PG-027-F007-A001-T007 existing client routes with only valid service context", async ({
  browser,
  baseURL,
}) => {
  for (const [query, target] of [
    [path, "/services?service=" + service],
    ["/login?service=a&service=b", "/dashboard"],
    ["/login?service=a%2Fb", "/dashboard"],
  ]) {
    await test.step(query, async () => {
      const context = await browser.newContext({ baseURL })
      try {
        const page = await context.newPage()
        await restoreSession(page, "USER")
        let release = () => {}
        const gate = new Promise<void>((resolve) => {
          release = resolve
        })
        let accountReads = 0
        let logins = 0
        await page.route("**/api/auth/me", async (route) => {
          accountReads++
          await gate
          await route.fallback()
        })
        page.on("request", (r) => {
          if (new URL(r.url()).pathname === "/api/auth/login") logins++
        })
        try {
          await page.goto(query)
          await expect.poll(() => accountReads).toBeGreaterThan(0)
          await expect(
            page
              .getByRole("status")
              .filter({ hasText: "Checking your session" }),
          ).toBeVisible()
        } finally {
          release()
        }
        await expect(page).toHaveURL(new URL(target, baseURL).toString())
        expect(logins).toBe(0)
        expect(
          (await storedTokens(page)).join(",") === "test-session,test-refresh",
        ).toBe(true)
      } finally {
        await context.close()
      }
    })
  }
})

test("PG-027-F008-A001-T008 rejects new internal sign-ins and clears local credentials", async ({
  browser,
  baseURL,
}) => {
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"] as const) {
    for (const status of [204, 503]) {
      await test.step(role + " logout " + status, async () => {
        const context = await browser.newContext({ baseURL })
        try {
          const page = await context.newPage()
          await mockApi(page, role)
          let release = () => {}
          const held = new Promise<void>((resolve) => {
            release = resolve
          })
          const match: boolean[] = []
          await page.route("**/api/auth/logout", async (route) => {
            match.push(
              route.request().method() === "POST" &&
                route.request().headers().authorization ===
                  "Bearer test-session",
            )
            await held
            await route.fulfill(
              status === 204
                ? { status }
                : { status, json: { error: "Synthetic unavailable" } },
            )
          })
          await page.goto(path)
          const destinations: string[] = []
          page.on("framenavigated", (frame) => {
            const pathname = new URL(frame.url()).pathname
            if (frame === page.mainFrame() && pathname !== "/login")
              destinations.push(pathname)
          })
          try {
            await signIn(page)
            await expect.poll(() => match.length).toBe(1)
            expect(match).toEqual([true])
          } finally {
            release()
          }
          await expect
            .soft(page.getByText(copy.clientAccountRequired, { exact: true }))
            .toBeVisible()
          await expect.soft(submit(page)).toBeEnabled()
          expect.soft(await storedTokens(page)).toEqual([null, null])
          expect.soft(destinations).toEqual([])
          await expect.soft(page).toHaveURL(/\/login\?service=service-1$/)
        } finally {
          await context.close()
        }
      })
    }
  }
})

test("PG-027-F017-A001-T017 client split and keyboard access at six widths", async ({
  page,
}, testInfo) => {
  for (const width of [849, 850, 851, 1099, 1100, 1101]) {
    await test.step(width + " CSS px", async () => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/login")
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true)
      const layout = await page.getByRole("main").evaluate((node) => {
        const style = getComputedStyle(node)
        return { display: style.display, columns: style.gridTemplateColumns }
      })
      testInfo.annotations.push({
        type: "layout",
        description: width + ": " + JSON.stringify(layout),
      })
      const controls = [
        emailField(page),
        passwordField(page),
        submit(page),
        page.getByRole("button", { name: "Show password" }),
        page.getByRole("button", { name: "Language: English" }),
        page.locator('a[href="/register"]'),
        page.locator('a[href="/forgot-password"]'),
      ]
      for (const control of controls) await expect.soft(control).toBeVisible()
      const reached = new Set<number>()
      for (let i = 0; i < 22 && reached.size < controls.length; i++) {
        await page.keyboard.press("Tab")
        for (const [index, control] of controls.entries()) {
          if (
            await control.evaluateAll((nodes) =>
              nodes.some((node) => node === document.activeElement),
            )
          )
            reached.add(index)
        }
      }
      expect.soft(reached.size).toBe(controls.length)
      await expect
        .soft(page.locator('a[href="/forgot-password"]'))
        .toHaveAttribute("href", "/forgot-password")
    })
  }
})
