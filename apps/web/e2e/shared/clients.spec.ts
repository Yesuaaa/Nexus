import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

test.describe("Client management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const width of [1280, 390]) {
    test(`client pagination shows only the requested page while loading at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "ADMIN")
      const firstPage = Array.from({ length: 10 }, (_, index) => ({
        id: `directory-client-${index + 1}`,
        fullName: `Directory Client ${index + 1}`,
        email: `directory-${index + 1}@example.test`,
        contactNumber: null,
        isActive: true,
        createdAt: `2026-11-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      }))
      const lastClient = {
        id: "directory-client-11",
        fullName: "Directory Client 11",
        email: "directory-11@example.test",
        contactNumber: null,
        isActive: true,
        createdAt: "2026-11-11T00:00:00Z",
      }
      let releasePage!: () => void
      let notifyPageStarted!: () => void
      const pageStarted = new Promise<void>((resolve) => {
        notifyPageStarted = resolve
      })
      const pendingPage = new Promise<void>((resolve) => {
        releasePage = resolve
      })
      await page.route("**/api/clients?**", async (route) => {
        const pageNumber = Number(
          new URL(route.request().url()).searchParams.get("page") ?? "1",
        )
        if (pageNumber === 2) {
          notifyPageStarted()
          await pendingPage
        }
        await route.fulfill({
          json: {
            clients: pageNumber === 2 ? [lastClient] : firstPage,
            total: 11,
            page: pageNumber,
            pageSize: 10,
          },
        })
      })
      try {
        await page.goto("/clients")
        const table = page.getByRole("table", { name: "Clients", exact: true })
        await expect(
          table.getByText("Directory Client 1", { exact: true }),
        ).toBeVisible()
        await expect(page.getByText("Showing 1–10 of 11")).toBeVisible()
        await page.getByRole("button", { name: "Page 2", exact: true }).click()
        await pageStarted
        await expect(table).toHaveAttribute("aria-busy", "true")
        await expect(
          table.getByText("Directory Client 1", { exact: true }),
        ).toHaveCount(0)
        const skeletonRows = table.getByRole("rowgroup").nth(1).getByRole("row")
        await expect(skeletonRows).toHaveCount(10)
        for (const row of await skeletonRows.all())
          await expect(row.getByRole("cell")).toHaveCount(6)
        await expect(page.getByText("Showing 1–10 of 11")).toHaveCount(0)
        releasePage()
        await expect(table.getByText("Directory Client 11")).toBeVisible()
        await expect(page.getByText("Showing 11–11 of 11")).toBeVisible()
      } finally {
        releasePage()
      }
    })
  }

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
      if (role !== "ADMIN" && role !== "SUPERADMIN") {
        await expect(page).toHaveURL(
          role === "USER" ? /\/dashboard$/ : /\/module$/,
        )
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
          name: "Request submitted",
          exact: true,
        }),
      ).toHaveCount(0)
      await expect(submit).toBeEnabled()
      expect(submissions).toHaveLength(1)
      await submit.click()
      await expect(
        page.getByRole("heading", {
          name: "Request submitted",
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
            name: "Request submitted",
            exact: true,
          }),
        ).toBeFocused()
        await expect(
          page.getByRole("link", {
            name: "View booked requests",
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
          .getByRole("button", { name: "Back to services", exact: true })
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

  for (const width of [1280, 390]) {
    test(`client related request pagination uses the requested page skeleton at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "ADMIN")
      const gate = () => {
        let start!: () => void
        let release!: () => void
        const started = new Promise<void>((resolve) => {
          start = resolve
        })
        const pending = new Promise<void>((resolve) => {
          release = resolve
        })
        return { started, pending, start, release: () => release() }
      }
      const initial = gate()
      const nextPage = gate()
      const initialProjects = gate()
      await page.route("**/api/clients/*/service-requests**", async (route) => {
        const url = new URL(route.request().url())
        const pageNumber = Number(url.searchParams.get("page") ?? "1")
        const requestGate = pageNumber === 1 ? initial : nextPage
        requestGate.start()
        await requestGate.pending
        return route.fulfill({
          json: {
            serviceRequests: [
              {
                id: `related-request-${pageNumber}`,
                title: `Related request page ${pageNumber}`,
                status: "SUBMITTED",
                createdAt: "2026-11-14T08:00:00.000Z",
                service: { id: "service-1", name: "Website Development" },
              },
            ],
            total: 2,
            page: pageNumber,
            pageSize: 1,
          },
        })
      })
      await page.route("**/api/clients/*/projects**", async (route) => {
        initialProjects.start()
        await initialProjects.pending
        return route.fulfill({
          json: {
            projects: [
              {
                id: "related-project-1",
                name: "Related project",
                status: "IN_PROGRESS",
                startDate: "2026-11-01T00:00:00.000Z",
                createdAt: "2026-10-30T08:00:00.000Z",
              },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
          },
        })
      })

      await page.goto("/clients")
      await page.getByRole("button", { name: /View.*Target User/i }).click()
      const drawer = page.getByRole("dialog")
      await drawer.getByRole("tab", { name: "Service requests" }).click()
      const desktopTable = drawer.locator("table")
      const mobileList = drawer.getByRole("list", { name: "Service requests" })
      await initial.started

      if (width > 800) {
        await expect(desktopTable).toBeVisible()
        await expect(desktopTable.locator("thead th")).toHaveCount(4)
        const skeletonRows = desktopTable.locator("tbody tr")
        await expect(skeletonRows).toHaveCount(2)
        for (const row of await skeletonRows.all())
          await expect(row.locator("td")).toHaveCount(4)
        await expect(desktopTable.getByRole("status")).toContainText(
          "Loading service requests",
        )
      } else {
        await expect(desktopTable).toBeHidden()
        await expect(mobileList).toBeVisible()
        await expect(
          mobileList.locator('[role="listitem"][aria-hidden="true"]'),
        ).toHaveCount(1)
        await expect(mobileList.getByRole("status")).toContainText(
          "Loading service requests",
        )
      }

      initial.release()
      const firstRequest =
        width > 800
          ? desktopTable.getByText("Related request page 1", { exact: true })
          : mobileList.getByText("Related request page 1", { exact: true })
      await expect(firstRequest).toBeVisible()
      const nextButton = drawer.getByRole("button", {
        name: "Next",
        exact: true,
      })
      await nextButton.click()
      await nextPage.started
      if (width > 800) {
        await expect(desktopTable).toHaveAttribute("aria-busy", "true")
        await expect(firstRequest).toHaveCount(0)
        const skeletonRows = desktopTable.locator("tbody tr")
        await expect(skeletonRows).toHaveCount(2)
        for (const row of await skeletonRows.all())
          await expect(row.locator("td")).toHaveCount(4)
      } else {
        await expect(mobileList).toHaveAttribute("aria-busy", "true")
        await expect(firstRequest).toHaveCount(0)
        await expect(
          mobileList.locator('[role="listitem"][aria-hidden="true"]'),
        ).toHaveCount(1)
        await expect(mobileList.getByRole("status")).toContainText(
          "Loading service requests",
        )
      }
      nextPage.release()
      const secondRequest =
        width > 800
          ? desktopTable.getByText("Related request page 2", { exact: true })
          : mobileList.getByText("Related request page 2", { exact: true })
      await expect(secondRequest).toBeVisible()

      await drawer.getByRole("tab", { name: "Projects" }).click()
      await initialProjects.started
      const projectList = drawer.getByRole("list", { name: "Projects" })
      if (width > 800) {
        await expect(desktopTable.locator("thead th")).toHaveCount(3)
        const skeletonRows = desktopTable.locator("tbody tr")
        await expect(skeletonRows).toHaveCount(2)
        for (const row of await skeletonRows.all())
          await expect(row.locator("td")).toHaveCount(3)
      } else {
        await expect(desktopTable).toBeHidden()
        await expect(
          projectList.locator('[role="listitem"][aria-hidden="true"]'),
        ).toHaveCount(1)
        await expect(projectList.getByRole("status")).toContainText(
          "Loading projects",
        )
      }
      initialProjects.release()
      const projectName =
        width > 800
          ? desktopTable.getByText("Related project", { exact: true })
          : projectList.getByText("Related project", { exact: true })
      await expect(projectName).toBeVisible()
    })
  }
})
