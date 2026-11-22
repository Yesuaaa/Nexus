import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

const payrollRequest: {
  id: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
  withdrawnAt: string | null
  withdrawnBy: string | null
  needsFinancialCorrection: boolean
  employee: { fullName: string; employeeId: string }
  payslip: { id: string; reference: string } | null
  messages: {
    id: string
    isAdmin: boolean
    body: string
    createdAt: string
  }[]
  activity: {
    id: string
    action: string
    actorRoleAtTime: string
    changedFields: string[]
    createdAt: string
    changes: {
      activity: string
      requestStatus?: { before: string; after: string }
    }
  }[]
} = {
  id: "payroll-request-detail-one",
  type: "MISSING_SALARY_PAYMENT",
  status: "OPEN",
  createdAt: "2026-11-17T08:00:00.000Z",
  updatedAt: "2026-11-17T08:00:00.000Z",
  withdrawnAt: null,
  withdrawnBy: null,
  needsFinancialCorrection: false,
  employee: { fullName: "Morgan Payroll", employeeId: "EMP-001" },
  payslip: { id: "payslip-one", reference: "PS-NOV-2026-001" },
  messages: [
    {
      id: "payroll-request-message-one",
      isAdmin: false,
      body: "My November salary payment is missing.",
      createdAt: "2026-11-17T08:00:00.000Z",
    },
  ],
  activity: [
    {
      id: "payroll-request-activity-one",
      action: "PAYROLL_DOCUMENT_ACTIVITY",
      actorRoleAtTime: "STAFF",
      changedFields: [],
      createdAt: "2026-11-17T08:00:00.000Z",
      changes: { activity: "REQUEST_CREATED" },
    },
  ],
}

test("Admin reviews a payroll request in a side panel with a sticky response action", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let responsePayload: Record<string, unknown> | undefined
  let listRequests = 0
  let responseAttempts = 0

  await page.route("**/api/payroll/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path.endsWith("/settings/preferences"))
      return route.fulfill({ json: {} })
    if (path.endsWith("/requests") && request.method() === "GET") {
      listRequests += 1
      return route.fulfill({
        json: {
          rows: [payrollRequest],
          page: 1,
          pageSize: 10,
          total: 1,
        },
      })
    }
    if (path.endsWith("/requests/" + payrollRequest.id)) {
      if (request.method() === "GET")
        return route.fulfill({ json: payrollRequest })
      if (request.method() === "PATCH") {
        responseAttempts += 1
        responsePayload = request.postDataJSON() as Record<string, unknown>
        if (responseAttempts === 1)
          return route.fulfill({
            status: 503,
            json: { error: "Payroll service is temporarily unavailable." },
          })
        payrollRequest.status = String(responsePayload.status)
        payrollRequest.updatedAt = "2026-11-17T09:00:00.000Z"
        payrollRequest.messages.push({
          id: "payroll-request-admin-response",
          isAdmin: true,
          body: String(responsePayload.message),
          createdAt: payrollRequest.updatedAt,
        })
        payrollRequest.activity!.push({
          id: "payroll-request-status-change",
          action: "PAYROLL_DOCUMENT_ACTIVITY",
          actorRoleAtTime: "ADMIN",
          changedFields: ["status"],
          createdAt: payrollRequest.updatedAt,
          changes: {
            activity: "REQUEST_UPDATED",
            requestStatus: { before: "OPEN", after: payrollRequest.status },
          },
        })
        return route.fulfill({ json: payrollRequest })
      }
    }
    if (path.endsWith("/payslips"))
      return route.fulfill({
        json: { rows: [], page: 1, pageSize: 10, total: 0 },
      })

    return route.fulfill({ json: {} })
  })

  await page.goto("/module/payroll/payslips")
  await page
    .getByRole("button", { name: "Payroll Requests", exact: true })
    .click()
  await page.getByRole("button", { name: "View request" }).click()

  const panel = page.getByRole("dialog", { name: "Payroll Request Details" })
  await expect(panel).toBeVisible()
  await expect(
    panel.getByText("Missing salary payment", { exact: true }),
  ).toBeVisible()
  await expect(panel.getByText("Morgan Payroll", { exact: true })).toBeVisible()
  await expect(
    panel.getByText("My November salary payment is missing.", { exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByText("PS-NOV-2026-001", { exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole("region", { name: "Activity history" }),
  ).toContainText("Concern submitted")

  const footer = panel.locator("footer")
  const saveResponse = footer.getByRole("button", { name: "Save response" })
  await expect(saveResponse).toBeVisible()
  await panel.getByRole("combobox", { name: "Update status" }).click()
  await page.getByRole("option", { name: "In review" }).click()
  await panel
    .getByLabel("Response or resolution notes")
    .fill("We are checking the November payroll record.")

  await panel.getByRole("button", { name: "Close panel" }).click()
  const discardDialog = page.getByRole("dialog", {
    name: "Discard unsaved response?",
  })
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole("button", { name: "Cancel" }).click()
  await expect(panel.getByLabel("Response or resolution notes")).toHaveValue(
    "We are checking the November payroll record.",
  )

  await saveResponse.click()
  await expect(
    panel.getByText("Payroll service is temporarily unavailable."),
  ).toBeVisible()
  await expect(panel.getByLabel("Response or resolution notes")).toHaveValue(
    "We are checking the November payroll record.",
  )
  await saveResponse.click()

  await expect(page.getByText("Payroll request updated")).toBeVisible()
  await expect.poll(() => listRequests).toBeGreaterThan(1)
  expect(responsePayload).toMatchObject({
    status: "IN_REVIEW",
    message: "We are checking the November payroll record.",
  })
  await expect(
    page
      .getByRole("region", { name: "Payroll requests" })
      .getByText("In review", { exact: true }),
  ).toBeVisible()
})
