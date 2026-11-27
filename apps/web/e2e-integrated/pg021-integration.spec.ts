import { expect, test } from "@playwright/test"

test("PG-021-F001-A025-T001 membership persists through the real Next rewrite", async ({
  page,
  request,
}) => {
  type Fixture = {
    token: string
    departmentId: string
    actorId: string
    userDepartmentId: string | null
    employeeDepartmentId: string | null
    receipts: string[]
    history: { actorAccountId: string }[]
  }
  const fixture = async (): Promise<Fixture> => {
    const response = await request.get("http://127.0.0.1:5284/__pg021")
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const before = await fixture()
  expect(before.userDepartmentId).toBeNull()
  expect(before.employeeDepartmentId).toBeNull()
  expect(before.history).toHaveLength(0)
  await page.addInitScript((token) => {
    sessionStorage.setItem("nexus.auth.token", token)
  }, before.token)
  await page.goto("/departments")
  const row = page.getByRole("button", {
    name: "PG021 Engineering",
    exact: true,
  })
  await row.click()
  await page.getByRole("button", { name: "Assign", exact: true }).click()
  const path = `/api/departments/${before.departmentId}/members`
  const write = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Assign PG021 Candidate" }).click()
  const response = await write
  expect(response.status()).toBe(200)
  expect(new URL(response.url()).origin).toBe("http://127.0.0.1:5283")
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await row.click()
  await expect(
    page.getByRole("region", { name: "Current members" }),
  ).toContainText("PG021 Candidate")
  const after = await fixture()
  expect(after.receipts).toContain(`POST ${path}`)
  expect(after.receipts).toContain(
    `GET /api/departments/${before.departmentId}`,
  )
  expect(after.userDepartmentId).toBe(before.departmentId)
  expect(after.employeeDepartmentId).toBe(before.departmentId)
  expect(after.history.length).toBeGreaterThan(0)
  expect(
    after.history.every((change) => change.actorAccountId === before.actorId),
  ).toBe(true)
})
