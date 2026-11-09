import { expect, test } from "@playwright/test"
import { restoreSession } from "../regression-support"

for (const route of ["/login", "/register"]) {
  test(`${route} renders with styles allowed by CSP`, async ({ page }) => {
    const stylesheets: string[] = []
    const policyViolations: string[] = []
    page.on("request", (request) => {
      if (request.resourceType() === "stylesheet") {
        stylesheets.push(request.url())
      }
    })
    await page.exposeFunction("reportPolicyViolation", (directive: string) => {
      policyViolations.push(directive)
    })
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const report = Reflect.get(window, "reportPolicyViolation") as (
          directive: string,
        ) => Promise<void>
        void report(event.violatedDirective)
      })
    })

    const response = await page.goto(route)
    expect(response?.status()).toBe(200)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator("body")).toHaveCSS("margin", "0px")

    const styles = await page.locator("style").evaluateAll((elements) =>
      elements.map((element) => ({
        nonce: element.nonce,
        content: element.textContent,
      })),
    )
    for (const style of styles) {
      expect(style.nonce).toBeTruthy()
      expect(style.content).toBeTruthy()
    }
    expect(stylesheets.length).toBeGreaterThan(0)
    for (const url of stylesheets) {
      expect(new URL(url).pathname).toMatch(/^\/_next\/static\/.*\.css$/)
    }
    // Keep portal utilities out of the public page's render-blocking CSS.
    const css = await Promise.all(
      [...new Set(stylesheets)].map(async (url) => {
        const response = await page.request.get(url)
        expect(response.ok()).toBe(true)
        return response.body()
      }),
    )
    expect(css.reduce((bytes, body) => bytes + body.length, 0)).toBeLessThan(
      80_000,
    )
    expect(policyViolations).toEqual([])
  })
}

test("route utilities stay styled across auth and portal navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await restoreSession(page, "ADMIN")
  await page.goto("/login")
  await expect(page).toHaveURL(/\/dashboard$/)
  const dashboard = page.getByRole("main", { name: "Dashboard", exact: true })
  await expect(dashboard).toHaveCSS("border-radius", "13px")
  await expect(dashboard).toHaveCSS("background-color", "rgb(243, 247, 249)")

  await page.getByRole("button", { name: "Sign Out", exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator("main[lang]")).toHaveCSS("display", "grid")
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator("main[lang]")).toHaveCSS("display", "block")
  await expect(page.locator("aside")).toBeHidden()
})
