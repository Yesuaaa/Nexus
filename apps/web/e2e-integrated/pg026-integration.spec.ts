import { expect, test } from "@playwright/test"

type Snapshot = {
  owner: string
  sessions: { userId: string; _count: { refreshTokens: number } }[]
  receipts: { path: string; status: number }[]
}

test("PG-026-F016-A001-T016 workforce sign-in crosses the real Next rewrite", async ({
  page,
  request,
  baseURL,
}) => {
  const snapshot = async () => {
    const response = await request.get("http://127.0.0.1:5296/__pg026")
    expect(response.ok()).toBe(true)
    return (await response.json()) as Snapshot
  }
  const before = await snapshot()
  expect(before.sessions).toEqual([])
  await page.goto("/internal/login")
  await page
    .getByLabel("Email address", { exact: true })
    .fill("pg026-admin@example.test")
  await page
    .getByLabel("Password", { exact: true })
    .fill("PG026 Synthetic integration 123!")
  const login = page.waitForResponse(
    (response) =>
      response.url() === baseURL + "/api/auth/login" &&
      response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  expect.soft((await login).status()).toBe(200)
  await expect.soft(page).toHaveURL(/\/module$/)
  await expect
    .soft(page.getByRole("main", { name: "Workspace selector" }))
    .toBeVisible()
  await expect.soft
    .poll(async () => (await snapshot()).receipts)
    .toContainEqual({ path: "GET /api/auth/me", status: 200 })
  const after = await snapshot()
  expect(
    after.receipts.filter((receipt) => receipt.path === "POST /api/auth/login"),
  ).toEqual([{ path: "POST /api/auth/login", status: 200 }])
  expect(after.sessions).toEqual([
    { userId: before.owner, _count: { refreshTokens: 1 } },
  ])
})
