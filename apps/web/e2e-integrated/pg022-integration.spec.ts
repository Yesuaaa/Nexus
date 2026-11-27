import { expect, test } from "@playwright/test"

test("PG-022-F012-A002-T009 reads a seeded department via the real Next rewrite", async ({
  page,
  request,
}) => {
  async function fixture() {
    const response = await request.get("http://127.0.0.1:5284/__pg021")
    expect(response.ok()).toBe(true)
    return response.json() as Promise<{
      token: string
      departmentId: string
      receipts: string[]
      history: unknown[]
      employeeDepartmentId: string | null
      userDepartmentId: string | null
    }>
  }
  const before = await fixture()
  await page.addInitScript((token) => {
    sessionStorage.setItem("nexus.auth.token", token)
  }, before.token)
  const list = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/departments" &&
      response.request().method() === "GET",
  )
  await page.goto("/departments")
  const response = await list
  expect(response.status()).toBe(200)
  expect(new URL(response.url()).origin).toBe("http://127.0.0.1:5283")
  expect(await response.json()).toMatchObject({
    departments: [{ id: before.departmentId, name: "PG021 Engineering" }],
  })
  await expect(
    page.getByRole("button", { name: "PG021 Engineering", exact: true }),
  ).toBeVisible()
  const after = await fixture()
  expect(after.receipts.slice(before.receipts.length)).toContain(
    "GET /api/departments",
  )
  expect(after.history).toEqual(before.history)
  expect(after.employeeDepartmentId).toBe(before.employeeDepartmentId)
  expect(after.userDepartmentId).toBe(before.userDepartmentId)
})
