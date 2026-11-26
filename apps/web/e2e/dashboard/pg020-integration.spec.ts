import { test, expect } from "@playwright/test"

test("[PG-020-F001-A008-T003] real Next rewrite preserves client notification isolation", async ({
  page,
  request,
}) => {
  type Fixture = {
    token: string
    actor: string
    reads: string[]
    notices: { id: string; readAt: string | null }[]
  }
  const fixture = (await (
    await request.get("http://127.0.0.1:5274/__pg020")
  ).json()) as Fixture
  await page.addInitScript((token) => {
    sessionStorage.setItem("nexus.auth.token", token)
  }, fixture.token)
  const responses: string[] = []
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/"))
      responses.push(response.url())
  })
  await page.goto("/dashboard")
  await expect(
    page.getByRole("main", { name: "Client dashboard", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await expect(
    page.getByRole("menuitem", { name: /PG020 public own notice/ }),
  ).toBeVisible()
  await expect(page.getByText("PG020 private sentinel")).toHaveCount(0)
  const after = (await (
    await request.get("http://127.0.0.1:5274/__pg020")
  ).json()) as Fixture
  expect(after.reads).toContain("GET /api/auth/me")
  expect(after.reads).toContain("GET /api/request-workflows/notifications")
  expect(after.notices).toEqual(fixture.notices)
  expect(responses.length).toBeGreaterThan(0)
  expect(
    responses.every((url) => new URL(url).origin === "http://127.0.0.1:5273"),
  ).toBe(true)
})
