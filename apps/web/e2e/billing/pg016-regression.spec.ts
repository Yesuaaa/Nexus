import { test, expect, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  restoreSession,
  live,
} from "../regression-support"

configureRegressionTest()
test.skip(live, "PG-016 controlled HTTP fixtures")
const route = "/billing-logs"
const endpoint = "**/api/request-workflows/billing"
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZyQAAAAASUVORK5CYII=",
  "base64",
)
const payment = {
  id: "payment",
  requestId: "request",
  serviceName: "PG-016 Service",
  bookingReference: "PG016-BOOKING",
  amount: "125.07",
  currency: "PHP",
  status: "PENDING",
  reference: null,
  approvedAt: null,
  verifiedAt: null,
  submittedAt: null,
  sandbox: false,
  proofFile: null,
}
function proof(id: string, mimeType = "image/png") {
  return {
    ...payment,
    id,
    serviceName: "Service " + id,
    status: "SUBMITTED",
    proofFile: {
      id: "file-" + id,
      name: id + (mimeType === "image/png" ? ".png" : ".pdf"),
      mimeType,
    },
  }
}
function gate() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
async function setup(page: Page, rows: unknown[] = [payment]) {
  await restoreSession(page, "USER")
  await page.route(endpoint, (r) => r.fulfill({ json: rows }))
}
async function close(page: Page) {
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

test("[PG-016-F001-A007-T001] conversation and payment links encode request and workflow identifiers", async ({
  page,
}) => {
  const requestId = "request?alpha&beta=value"
  const id = "payment#part&value"
  await setup(page, [{ ...payment, id, requestId }])
  const writes: string[] = []
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url())
  })
  // Capture navigation destinations to keep destination APIs outside this page test.
  await page.route("**/messages?**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<main>Conversation destination</main>",
    }),
  )
  for (const name of ["Go to chats", "Pay"]) {
    await page.goto(route)
    const review = page.getByRole("button", { name: "Review", exact: true })
    await review.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", {
      name: "Payment summary",
      exact: true,
    })
    const href =
      "/messages?request=" +
      encodeURIComponent(requestId) +
      (name === "Pay" ? "#workflow-" + encodeURIComponent(id) : "")
    const link = dialog.getByRole("link", {
      name: name === "Pay" ? /^Pay / : "Go to chats",
    })
    await expect(link).toHaveAttribute("href", href)
    await link.focus()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(new RegExp("messages"))
    expect(new URL(page.url()).search).toBe(
      "?request=" + encodeURIComponent(requestId),
    )
    expect(new URL(page.url()).hash).toBe(
      name === "Pay" ? "#workflow-" + encodeURIComponent(id) : "",
    )
  }
  expect(writes).toEqual([])
})

test("[PG-016-F001-A008-T002] delayed proof previews revoke stale and unmounted object URLs", async ({
  page,
}) => {
  await setup(page, [
    proof("first"),
    proof("second"),
    proof("pdf", "application/pdf"),
  ])
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    const state = { created: [] as string[], revoked: [] as string[] }
    Object.assign(window, { pg016Urls: state })
    URL.createObjectURL = (blob) => {
      const url = create(blob)
      state.created.push(url)
      return url
    }
    URL.revokeObjectURL = (url) => {
      state.revoked.push(url)
      revoke(url)
    }
  })
  const pending = gate()
  const firstFinished = gate()
  const fileReads: string[] = []
  await page.route("**/api/request-workflows/request/files/*", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").at(-1)!
    fileReads.push(name)
    if (name === "file-first") {
      await pending.promise
      try {
        await r.fulfill({ contentType: "image/png", body: png })
      } finally {
        firstFinished.release()
      }
    } else await r.fulfill({ contentType: "image/png", body: png })
  })
  const urls = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            pg016Urls: { created: string[]; revoked: string[] }
          }
        ).pg016Urls,
    )
  try {
    await page.goto(route)
    const first = page.waitForRequest((r) => r.url().endsWith("/file-first"))
    await page
      .getByRole("button", { name: "View proof", exact: true })
      .nth(0)
      .click()
    await first
    await close(page)
    await page
      .getByRole("button", { name: "View proof", exact: true })
      .nth(1)
      .click()
    await expect(
      page.getByRole("button", { name: "Enlarge payment proof", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Enlarge payment proof", exact: true })
      .click()
    const current = page.getByRole("img", {
      name: "Uploaded payment proof",
      exact: true,
    })
    const src = await current.getAttribute("src")
    pending.release()
    await firstFinished.promise
    await expect.poll(async () => (await urls()).created.length).toBe(2)
    await expect(current).toHaveAttribute("src", src!)
    const state = await urls()
    const stale = state.created.find((url) => url !== src)!
    expect(state.revoked).toContain(stale)
    await close(page)
    await expect.poll(async () => (await urls()).revoked).toContain(src!)
    await page
      .getByRole("button", { name: "View proof", exact: true })
      .nth(2)
      .click()
    await expect(
      page.getByRole("dialog", { name: "Payment proof", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Enlarge payment proof", exact: true }),
    ).toHaveCount(0)
    expect(fileReads).toEqual(["file-first", "file-second"])
  } finally {
    pending.release()
  }
})

test("[PG-016-F001-A009-T002] download fences dismissal and duplicate clicks then recovers", async ({
  page,
}) => {
  await setup(page, [
    proof("pdf", "application/pdf"),
    {
      ...payment,
      id: "second",
      serviceName: "Another payment",
      status: "VERIFIED",
    },
  ])
  const pending = gate()
  let reads = 0
  await page.route(
    "**/api/request-workflows/request/files/file-pdf",
    async (r) => {
      reads++
      if (reads === 1) {
        await pending.promise
        await r.fulfill({
          status: 503,
          json: { error: "Download fixture unavailable" },
        })
      } else
        await r.fulfill({
          contentType: "application/pdf",
          body: "%PDF-1.4 Synthetic test file",
        })
    },
  )
  try {
    await page.goto(route)
    await page.getByRole("button", { name: "View proof", exact: true }).click()
    const dialog = page.getByRole("dialog", {
      name: "Payment proof",
      exact: true,
    })
    const downloadButton = dialog.getByRole("button", {
      name: "Download proof",
      exact: true,
    })
    const started = page.waitForRequest((r) => r.url().endsWith("/file-pdf"))
    await downloadButton.click()
    await started
    await expect(
      dialog.getByRole("button", { name: "Downloading…", exact: true }),
    ).toBeDisabled()
    await dialog
      .getByRole("button", { name: "Downloading…", exact: true })
      .evaluate((button) => (button as HTMLButtonElement).click())
    await page.keyboard.press("Escape")
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
    await expect(dialog).toBeVisible()
    expect(reads).toBe(1)
    pending.release()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Download fixture unavailable",
    )
    await expect(downloadButton).toBeEnabled()
    const download = page.waitForEvent("download")
    await downloadButton.click()
    expect((await download).suggestedFilename()).toBe("pdf.pdf")
    await expect(dialog.getByRole("alert")).toHaveCount(0)
    await close(page)
    await page
      .getByRole("button", { name: "View payment", exact: true })
      .click()
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0)
    expect(reads).toBe(2)
  } finally {
    pending.release()
  }
})

test("[PG-016-F001-A012-T001] direct proof actions and dialog focus work at supported widths", async ({
  page,
}) => {
  const long = "Very long service " + "name ".repeat(24)
  await setup(page, [
    {
      ...proof("proof"),
      serviceName: long,
      bookingReference: "BOOKING-" + "X".repeat(90),
      reference: "REFERENCE-" + "Y".repeat(100),
    },
  ])
  await page.route("**/api/request-workflows/request/files/file-proof", (r) =>
    r.fulfill({ contentType: "image/png", body: png }),
  )
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(route)
    const action = page.getByRole("button", { name: "View proof", exact: true })
    await action.focus()
    await page.keyboard.press("Shift+Tab")
    await page.keyboard.press("Tab")
    await expect(action).toBeFocused()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", {
      name: "Payment proof",
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(long)
    const enlarge = dialog.getByRole("button", {
      name: "Enlarge payment proof",
      exact: true,
    })
    await enlarge.focus()
    await page.keyboard.press("Enter")
    await expect(
      dialog.getByRole("img", { name: "Uploaded payment proof", exact: true }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect
      .soft(
        action,
        "Dialog returns focus to the initiating proof action at " +
          width +
          "px",
      )
      .toBeFocused({ timeout: 1500 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
  }
})

test("[PG-016-F001-A002-T002] obsolete billing responses stay retired and an expired bearer refreshes", async ({
  page,
}) => {
  await setup(page)
  const old = gate()
  const completed = gate()
  const started = gate()
  let reads = 0
  let refreshes = 0
  const tokens: (string | undefined)[] = []
  await page.route("**/api/auth/refresh", (r) => {
    refreshes++
    return r.fulfill({
      json: {
        token: "pg016-renewed",
        refreshToken: "pg016-refresh",
        expiresIn: 300,
      },
    })
  })
  await page.route(endpoint, async (r) => {
    reads++
    tokens.push(r.request().headers().authorization)
    if (reads === 1) {
      started.release()
      await old.promise
      try {
        await r.fulfill({
          json: [{ ...payment, serviceName: "Obsolete service" }],
        })
      } finally {
        completed.release()
      }
    } else if (r.request().headers().authorization !== "Bearer pg016-renewed") {
      await r.fulfill({
        status: 401,
        json: { error: "Expired fixture", code: "ACCESS_TOKEN_EXPIRED" },
      })
    } else
      await r.fulfill({
        json: [{ ...payment, serviceName: "Current service" }],
      })
  })
  try {
    await page.goto(route)
    await started.promise
    await page.goto("/profile")
    await page.goto(route)
    await expect(
      page.getByText("Current service", { exact: true }),
    ).toBeVisible()
    old.release()
    await completed.promise
    await expect(
      page.getByText("Obsolete service", { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText("Current service", { exact: true }),
    ).toBeVisible()
    expect(refreshes).toBe(1)
    expect(tokens).toEqual([
      "Bearer test-session",
      "Bearer test-session",
      "Bearer pg016-renewed",
    ])
  } finally {
    old.release()
  }
})
