import { expect, test } from "@playwright/test"

test("PG-023-F003-A002-T033 reads employee list and detail through the Next rewrite", async ({
  page,
  request,
  baseURL,
}) => {
  async function fixture() {
    const response = await request.get("http://127.0.0.1:5286/__pg023")
    expect(response.ok()).toBe(true)
    return response.json() as Promise<{
      token: string
      employeeId: string
      receipts: string[]
      snapshot: unknown
    }>
  }
  const before = await fixture()
  await page.addInitScript((token) => {
    sessionStorage.setItem("nexus.auth.token", token)
  }, before.token)
  const waitForRead = (path: string) =>
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === path &&
        response.request().method() === "GET",
    )
  const list = waitForRead("/api/employees")
  await page.goto("/employees")
  const listResponse = await list
  expect(listResponse.status()).toBe(200)
  expect(new URL(listResponse.url()).origin).toBe(baseURL)
  const projection = {
    id: before.employeeId,
    employeeId: "EXP-REWRITE",
    fullName: "PG023 Rewrite Employee",
    hasEmployeeRecord: true,
  }
  expect(await listResponse.json()).toMatchObject({
    employees: expect.arrayContaining([expect.objectContaining(projection)]),
  })
  await expect(
    page.getByText("PG023 Rewrite Employee", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "More actions for PG023 Rewrite Employee" })
    .click()
  const detailPath = `/api/employees/${before.employeeId}`
  const detail = waitForRead(detailPath)
  await page
    .getByRole("menuitem", { name: "View Employee", exact: true })
    .click()
  const detailResponse = await detail
  expect(detailResponse.status()).toBe(200)
  expect(new URL(detailResponse.url()).origin).toBe(baseURL)
  expect(await detailResponse.json()).toMatchObject({ employee: projection })
  await expect(page.getByRole("dialog")).toContainText("EXP-REWRITE")
  const after = await fixture()
  expect(after.receipts.slice(before.receipts.length)).toEqual([
    "GET /api/employees",
    `GET ${detailPath}`,
  ])
  expect(after.snapshot).toEqual(before.snapshot)
})
