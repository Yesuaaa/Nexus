import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("[NEX-018] client reviews billing due and history with proof preview and download recovery", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  const payment = {
    id: "payment-1",
    requestId: "request-1",
    serviceName: "Website Development",
    bookingReference: "BK-NEX018",
    amount: "1500.00",
    currency: "PHP",
    status: "PENDING",
    reference: null,
    approvedAt: "2026-11-10T08:00:00Z",
    verifiedAt: null,
    submittedAt: null,
    sandbox: false,
    proofFile: null,
  }
  await page.route("**/api/request-workflows/billing", (route) =>
    route.fulfill({
      json: [
        payment,
        {
          ...payment,
          id: "payment-2",
          status: "SUBMITTED",
          reference: "TEST-PROOF",
          submittedAt: "2026-11-10T09:00:00Z",
          proofFile: {
            id: "proof-1",
            name: "proof.png",
            mimeType: "image/png",
          },
        },
      ],
    }),
  )
  let failDownload = false
  let fileReads = 0
  await page.route(
    "**/api/request-workflows/request-1/files/proof-1",
    (route) => {
      fileReads += 1
      return failDownload
        ? route.fulfill({
            status: 503,
            json: { error: "Proof temporarily unavailable" },
          })
        : route.fulfill({
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZyQAAAAASUVORK5CYII=",
              "base64",
            ),
          })
    },
  )
  await page.goto("/billing-logs")
  await expect(
    page.getByRole("heading", { name: "Due next", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Awaiting verification", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Review", exact: true }).click()
  let dialog = page.getByRole("dialog", {
    name: "Payment summary",
    exact: true,
  })
  await expect(dialog.getByRole("link", { name: /^Pay / })).toHaveAttribute(
    "href",
    "/messages?request=request-1#workflow-payment-1",
  )
  await expect(
    dialog.getByRole("link", { name: "Go to chats", exact: true }),
  ).toHaveAttribute("href", "/messages?request=request-1")
  await expect(dialog.getByText("BK-NEX018", { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "View proof", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "Payment proof", exact: true })
  await expect(
    dialog.getByRole("button", { name: "Enlarge payment proof", exact: true }),
  ).toBeVisible()
  await dialog
    .getByRole("button", { name: "Enlarge payment proof", exact: true })
    .click()
  await expect(
    dialog.getByRole("img", { name: "Uploaded payment proof", exact: true }),
  ).toBeVisible()
  failDownload = true
  await dialog
    .getByRole("button", { name: "Download proof", exact: true })
    .click()
  await expect(dialog.getByRole("alert")).toContainText(
    "Proof temporarily unavailable",
  )
  await expect(
    dialog.getByRole("button", { name: "Download proof", exact: true }),
  ).toBeEnabled()
  failDownload = false
  const download = page.waitForEvent("download")
  await dialog
    .getByRole("button", { name: "Download proof", exact: true })
    .click()
  expect((await download).suggestedFilename()).toBe("proof.png")
  await expect(dialog.getByRole("alert")).toHaveCount(0)
  expect(fileReads).toBe(3)
})

test("[NEX-018] billing loading empty and error states recover on reload", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let mode: "empty" | "error" = "empty"
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/request-workflows/billing", async (route) => {
    await gate
    return mode === "error"
      ? route.fulfill({
          status: 503,
          json: { error: "Billing temporarily unavailable" },
        })
      : route.fulfill({ json: [] })
  })
  await page.goto("/billing-logs")
  await expect(
    page.getByRole("status").filter({ hasText: "Loading billing records" }),
  ).toBeVisible()
  release()
  await expect(
    page.getByText("No payments due.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("No payment history yet.", { exact: true }),
  ).toBeVisible()
  mode = "error"
  await page.reload()
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Billing temporarily unavailable",
  )
  mode = "empty"
  await page.reload()
  await expect(
    page.getByText("No payments due.", { exact: true }),
  ).toBeVisible()
})

for (const role of ["STAFF", "ADMIN", "SUPERADMIN"] as const) {
  test(`[NEX-018] ${role} cannot open Billing Logs or fetch its records`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    let reads = 0
    await page.route("**/api/request-workflows/billing", (route) => {
      reads += 1
      return route.fulfill({ json: [] })
    })
    await page.goto("/billing-logs")
    await expect(page).toHaveURL(/\/module$/)
    await expect(
      page.getByRole("heading", { name: "Billing Logs", exact: true }),
    ).toHaveCount(0)
    expect(reads).toBe(0)
  })
}
