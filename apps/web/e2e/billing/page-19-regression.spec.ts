import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const maximumPayment = {
  id: "page-19-maximum-payment",
  requestId: "page-19-maximum-request",
  serviceName: "Maximum Precision Service",
  bookingReference: "P19-MAX-001",
  amount: "9999999999.99",
  currency: "PHP",
  status: "PENDING" as const,
  reference: null,
  approvedAt: "2026-11-10T08:00:00.000Z",
  verifiedAt: null,
  submittedAt: null,
  sandbox: false,
  proofFile: null,
  lineItems: [
    {
      description: "Maximum-value item",
      quantity: 1,
      unitPrice: "9999999999.99",
    },
  ],
}

test("Billing Logs keeps maximum Decimal amounts readable at supported widths", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "USER")
  await page.route("**/api/request-workflows/billing", (route) =>
    route.fulfill({ json: [maximumPayment] }),
  )
  await page.goto("/billing-logs")

  const dueSection = page.locator('section[aria-labelledby="billing-due"]')
  const amount = "₱9,999,999,999.99"
  for (const [width, height] of [
    [1440, 900],
    [1280, 850],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await expect(dueSection.getByText(amount, { exact: true })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Billing Logs overflows horizontally at ${width}px`,
    ).toBe(true)
    if (width === 390) {
      await page.screenshot({
        path: testInfo.outputPath("page-19-billing-mobile.png"),
        fullPage: true,
      })
      const review = page.getByRole("button", { name: "Review", exact: true })
      await review.focus()
      await page.keyboard.press("Enter")
      const dialog = page.getByRole("dialog", {
        name: "Payment summary",
        exact: true,
      })
      await expect(
        dialog.getByText(amount, { exact: true }).first(),
      ).toBeVisible()
      await expect(dialog.getByText("Due date", { exact: true })).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(dialog).toHaveCount(0)
    }
  }
})

test("Billing Logs lets clients download a linked sandbox receipt", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  await page.route("**/api/request-workflows/billing", (route) =>
    route.fulfill({
      json: [
        {
          ...maximumPayment,
          id: "page-19-sandbox-payment",
          requestId: "page-19-sandbox-request",
          serviceName: "Sandbox receipt service",
          bookingReference: "P19-SANDBOX-001",
          amount: "0.01",
          status: "VERIFIED",
          reference: "XENDIT-SANDBOX-P19",
          verifiedAt: "2026-11-11T10:30:00.000Z",
          sandbox: true,
          proofFile: {
            id: "page-19-sandbox-receipt",
            name: "sandbox-receipt.txt",
            mimeType: "text/plain",
          },
        },
      ],
    }),
  )
  await page.route(
    "**/api/request-workflows/page-19-sandbox-request/files/page-19-sandbox-receipt",
    (route) =>
      route.fulfill({
        contentType: "text/plain",
        body: "Sandbox receipt. Test payment only.",
      }),
  )
  await page.goto("/billing-logs")
  await page.getByRole("button", { name: "View receipt", exact: true }).click()
  const dialog = page.getByRole("dialog", {
    name: "Sandbox receipt",
    exact: true,
  })
  await expect(
    dialog.getByText("Test payment only. No money was charged."),
  ).toBeVisible()

  const download = page.waitForEvent("download")
  await dialog
    .getByRole("button", { name: "Download receipt", exact: true })
    .click()
  expect((await download).suggestedFilename()).toBe("sandbox-receipt.txt")
})

test("Billing Logs should show source booking data instead of fixed demo details", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "USER")
  await page.route("**/api/request-workflows/billing", (route) =>
    route.fulfill({
      json: [
        {
          ...maximumPayment,
          id: "page-19-demo-reference-payment",
          requestId: "page-19-demo-reference-request",
          serviceName: "Source-backed Website Redesign",
          bookingReference: "DEMO-BILLING-001",
          amount: "125.00",
          lineItems: null,
        },
      ],
    }),
  )
  await page.goto("/billing-logs")

  const dueRow = page
    .locator('section[aria-labelledby="billing-due"] li')
    .first()
  await page.screenshot({
    path: testInfo.outputPath("page-19-hard-coded-demo-billing-defect.png"),
    fullPage: true,
  })
  await expect.soft(dueRow).toContainText("Source-backed Website Redesign")
  await expect.soft(dueRow).toContainText("DEMO-BILLING-001")
  await expect.soft(dueRow).not.toContainText("INV-003")
  await expect.soft(dueRow).not.toContainText("Due Nov 20, 2026")

  await page.getByRole("button", { name: "Review", exact: true }).click()
  const dialog = page.getByRole("dialog", {
    name: "Payment summary",
    exact: true,
  })
  await expect(dialog).toContainText("Source-backed Website Redesign")
  await expect(dialog).toContainText("DEMO-BILLING-001")
  await expect(dialog).toContainText("Not specified")
})
