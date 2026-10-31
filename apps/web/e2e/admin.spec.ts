import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  accountFor,
  managementRoutes,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Admin access and permissions", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const feature of managementRoutes) {
    test(`${feature.path} denies access when the server withholds its read permission`, async ({
      page,
    }) => {
      const requests: string[] = []
      await restoreSession(page, feature.role, {
        account: {
          permissions: accountFor(feature.role).permissions.filter(
            (permission) => permission !== feature.permission,
          ),
        },
      })
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith(feature.endpoint))
          requests.push(request.url())
      })
      await page.goto(feature.path)
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(
        page.getByRole("heading", { name: feature.title }),
      ).toHaveCount(0)
      expect(requests).toEqual([])
    })

    test(`${feature.path} does not expose protected content when session lookup fails`, async ({
      page,
    }) => {
      await restoreSession(page, feature.role)
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({ status: 503, json: { error: "Unavailable" } }),
      )
      await page.goto(feature.path)
      await expect(
        page.getByText(
          "We couldn't load your account. Please refresh to try again.",
        ),
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: feature.title }),
      ).toHaveCount(0)
    })
  }
})
