import { expect, test } from "@playwright/test"

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
    expect(policyViolations).toEqual([])
  })
}
