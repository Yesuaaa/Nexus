import { expect, test } from "@playwright/test"

type Snapshot = {
  thread: string
  sender: string
  messages: { body: string; senderId: string; conversationId: string }[]
  sibling: unknown
  receipts: { path: string; status: number }[]
}

test("PG-028-F024-A001-T024 internal send and reload through the actual Next rewrite", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const upstream = "http://127.0.0.1:5300"
  const snapshot = async () => {
    const response = await request.get(upstream + "/__pg028")
    expect(response.ok()).toBe(true)
    return (await response.json()) as Snapshot
  }
  const before = await snapshot()
  const session = async (actor: "sender" | "outsider") => {
    const response = await request.get(upstream + "/__pg028/session/" + actor)
    expect(response.ok()).toBe(true)
    return (await response.json()) as { token: string; refreshToken: string }
  }
  const restore = (tokens: { token: string; refreshToken: string }) => {
    sessionStorage.setItem("nexus.auth.token", tokens.token)
    sessionStorage.setItem("nexus.auth.refreshToken", tokens.refreshToken)
  }
  expect(before.messages).toEqual([])
  await page.addInitScript(restore, await session("sender"))
  const path = "/api/internal-conversations/" + before.thread
  const location = "/messages?mode=internal&internal=" + before.thread
  const body = "PG028 synthetic transport proof"
  await page.goto(location)
  await page.getByRole("textbox", { name: /^Message\b/ }).fill(body)
  const send = page.waitForResponse(
    (response) =>
      response.url() === baseURL + path + "/messages" &&
      response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Send message", exact: true }).click()
  expect.soft((await send).status()).toBe(201)
  const afterSend = await snapshot()
  expect
    .soft(afterSend.messages)
    .toEqual([{ conversationId: before.thread, senderId: before.sender, body }])
  expect.soft(afterSend.sibling).toEqual(before.sibling)
  await page.reload()
  await expect
    .soft(page.getByRole("log").getByText(body, { exact: true }))
    .toHaveCount(1)
  const outsider = await browser.newPage({ baseURL })
  try {
    await outsider.addInitScript(restore, await session("outsider"))
    const denied = outsider.waitForResponse(
      (response) =>
        response.url() === baseURL + path &&
        response.request().method() === "GET",
    )
    await outsider.goto(location)
    expect.soft((await denied).status()).toBe(404)
    await expect.soft(outsider.getByText(body, { exact: true })).toHaveCount(0)
  } finally {
    await outsider.close()
  }
  const final = await snapshot()
  expect(final.receipts).toEqual(
    expect.arrayContaining([
      { path: "GET /api/internal-conversations", status: 200 },
      { path: "GET " + path, status: 200 },
      { path: "POST " + path + "/messages", status: 201 },
      { path: "GET " + path, status: 404 },
    ]),
  )
  expect(
    final.receipts.filter(
      (receipt) => receipt.path === "GET " + path && receipt.status === 200,
    ).length,
  ).toBeGreaterThanOrEqual(2)
  expect(final.messages).toEqual(afterSend.messages)
  expect(final.sibling).toEqual(before.sibling)
})
