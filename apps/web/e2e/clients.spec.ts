import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Client management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
    test(`${role} client directory access and related records respect navigation guards`, async ({
      page,
    }) => {
      await restoreSession(page, role)
      const requests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/clients"))
          requests.push(request.url())
      })
      await page.goto("/clients")
      if (role !== "ADMIN") {
        await expect(page).toHaveURL(/\/dashboard$/)
        expect(requests).toEqual([])
        return
      }
      await expect(
        page.getByRole("heading", { name: "Client Management" }),
      ).toBeVisible()
      await page.getByRole("button", { name: /View.*Target User/i }).click()
      await expect(page.getByRole("dialog")).toContainText("target@example.com")
      await page
        .getByRole("tab", { name: "Service requests", exact: true })
        .click()
      await expect(
        page.getByText("No service requests are linked to this client yet."),
      ).toBeVisible()
      await page.getByRole("tab", { name: "Projects", exact: true }).click()
      await expect(
        page.getByText("No projects are linked to this client yet."),
      ).toBeVisible()
      await page.getByRole("button", { name: "Close client details" }).click()
      await page
        .getByRole("searchbox", { name: "Search clients" })
        .fill("missing-client")
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: /No results for.*missing-client.*found/ }),
      ).toBeVisible()
      await page.getByRole("button", { name: "Clear filters" }).click()
      await expect(page.getByText("Target User", { exact: true })).toBeVisible()
    })
  }

  for (const width of [1280, 390]) {
    test(`client retries a failed submission without changing its request reference at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "USER")
      await page.route(
        "**/api/client/services/service-1/specialists",
        (route) => route.fulfill({ json: { specialists: [] } }),
      )
      const submissions: Record<string, unknown>[] = []
      await page.route("**/api/client/service-requests", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers().authorization).toBe(
          "Bearer test-session",
        )
        submissions.push(
          route.request().postDataJSON() as Record<string, unknown>,
        )
        if (submissions.length === 1) {
          await route.fulfill({
            status: 503,
            json: { error: "Submission temporarily unavailable" },
          })
          return
        }
        await route.fulfill({
          status: 201,
          json: {
            serviceRequest: {
              id: "retried-request",
              status: "SUBMITTED",
              createdAt: "2026-10-30T00:00:00.000Z",
            },
          },
        })
      })
      await page.goto("/services")
      await page
        .getByRole("button", { name: "Explore Test Service", exact: true })
        .click()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "EXPlore", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Select Standard service", exact: true })
        .click()
      await page.getByRole("button", { name: "Continue", exact: true }).click()
      for (const name of [
        "Project goals",
        "Project requirements",
        "Expected timeline",
      ])
        await page
          .getByRole("textbox", { name, exact: true })
          .fill(`${name} retained on retry`)
      await page.getByRole("button", { name: "Continue", exact: true }).click()
      const submit = page.getByRole("button", {
        name: "Submit service request for review",
        exact: true,
      })
      await submit.click()
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Submission temporarily unavailable" }),
      ).toBeVisible()
      await expect(
        page.getByRole("heading", {
          name: "Service request submitted for review",
          exact: true,
        }),
      ).toHaveCount(0)
      await expect(submit).toBeEnabled()
      expect(submissions).toHaveLength(1)
      await submit.click()
      await expect(
        page.getByRole("heading", {
          name: "Service request submitted for review",
          exact: true,
        }),
      ).toBeFocused()
      expect(submissions).toHaveLength(2)
      expect(submissions[1]).toEqual(submissions[0])
      expect(submissions[0].submissionKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(submissions[0]).not.toHaveProperty("clientId")
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Submission temporarily unavailable" }),
      ).toHaveCount(0)
    })

    test(`client submits standard service and starts a clean request at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "USER")
      await page.route(
        "**/api/client/services/service-1/specialists",
        (route) => route.fulfill({ json: { specialists: [] } }),
      )
      const submissions: Record<string, unknown>[] = []
      await page.route("**/api/client/service-requests", async (route) => {
        expect(route.request().method()).toBe("POST")
        submissions.push(
          route.request().postDataJSON() as Record<string, unknown>,
        )
        await route.fulfill({
          status: 201,
          json: {
            serviceRequest: {
              id: `request-${submissions.length}`,
              status: "SUBMITTED",
              createdAt: "2026-10-30T00:00:00.000Z",
            },
          },
        })
      })
      await page.goto("/services")
      for (let attempt = 1; attempt <= 2; attempt++) {
        await page
          .getByRole("button", { name: "Explore Test Service", exact: true })
          .click()
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "EXPlore", exact: true })
          .click()
        const select = page.getByRole("button", {
          name: "Select Standard service",
          exact: true,
        })
        await expect(select).toHaveAttribute("aria-pressed", "false")
        await select.click()
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click()
        for (const name of [
          "Project goals",
          "Project requirements",
          "Expected timeline",
        ]) {
          const input = page.getByRole("textbox", { name, exact: true })
          await expect(input).toHaveValue("")
          await input.fill(`${name} for request ${attempt}`)
        }
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click()
        await expect(
          page.getByText(/No specialists are currently listed/),
        ).toBeVisible()
        await page
          .getByRole("button", {
            name: "Submit service request for review",
            exact: true,
          })
          .click()
        await expect(
          page.getByRole("heading", {
            name: "Service request submitted for review",
            exact: true,
          }),
        ).toBeFocused()
        await expect(
          page.getByRole("link", {
            name: "View service requests",
            exact: true,
          }),
        ).toHaveAttribute("href", "/service-requests")
        expect(submissions).toHaveLength(attempt)
        expect(submissions[attempt - 1]).toMatchObject({
          serviceId: "service-1",
          packageId: null,
          preferredSpecialistId: null,
          goals: `Project goals for request ${attempt}`,
          additionalDetails: "",
        })
        expect(submissions[attempt - 1]).not.toHaveProperty("clientId")
        await page
          .getByRole("button", { name: "Start another request", exact: true })
          .click()
      }
      expect(submissions[0].submissionKey).toEqual(expect.any(String))
      expect(submissions[1].submissionKey).not.toBe(
        submissions[0].submissionKey,
      )
    })

    test(`admin client form preserves input until explicitly cancelled at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "ADMIN")
      await page.goto("/clients")
      const opener = page.getByRole("button", {
        name: "Create Client",
        exact: true,
      })
      await opener.click()
      const dialog = page.getByRole("dialog")
      await dialog.getByLabel("Full Name").fill("Draft Client")
      await dialog.getByLabel("Email Address").fill("draft@example.com")
      await page.mouse.click(2, 2)
      await page.keyboard.press("Escape")
      await expect(dialog.getByLabel("Full Name")).toHaveValue("Draft Client")
      await expect(dialog.getByLabel("Email Address")).toHaveValue(
        "draft@example.com",
      )
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(opener).toBeFocused()
      await opener.click()
      await expect(dialog.getByLabel("Full Name")).toHaveValue("")
    })
  }
})
