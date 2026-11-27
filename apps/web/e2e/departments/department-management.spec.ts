import { expect, test } from "@playwright/test"
import type { Department } from "../../src/features/departments/api/departments-api"
import { autoDepartmentColor } from "../../src/components/ui/department-pill"
import { configureRegressionTest, restoreSession } from "../regression-support"

import { responseGate } from "../support/pg021-response-gate"

configureRegressionTest()

function departmentFixture(index: number): Department {
  const suffix = String(index).padStart(2, "0")
  const timestamp = "2026-01-01T00:00:00.000Z"
  return {
    id: `department-${suffix}`,
    name: `Department ${suffix}`,
    code: `CODE-${suffix}`,
    color: "teal",
    description: null,
    headId: null,
    head: null,
    memberCount: index,
    teamCount: index % 4,
    serviceCount: index % 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

test("PG-021-F001-A007-T001 preset, manual color and pending edit", async ({
  page,
}) => {
  const department = {
    ...departmentFixture(1),
    description: "Original note",
    headId: "pg021-head",
  }
  const departments = [department]
  const saved = responseGate()
  await restoreSession(page, "ADMIN", { initialDepartments: departments })
  await page.route("**/api/departments", (route) =>
    route.fulfill({ json: { departments } }),
  )
  await page.route("**/api/departments/eligible-heads?**", (route) =>
    route.fulfill({
      json: {
        users: [
          {
            id: "pg021-head",
            fullName: "Current Head",
            email: "head@example.test",
            role: "STAFF",
            headOf: null,
          },
        ],
      },
    }),
  )
  let updates = 0
  await page.route(`**/api/departments/${department.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.fallback()
    updates++
    await saved.promise
    departments[0] = { ...department, ...route.request().postDataJSON() }
    return route.fulfill({ json: { department: departments[0] } })
  })

  await page.goto("/departments")
  await page.getByRole("button", { name: "Create Department" }).click()
  const dialog = page.getByRole("dialog")
  const name = dialog.getByLabel("Department Name")
  const code = dialog.getByLabel("Department Code")
  const description = dialog.getByLabel("Description")
  const preset = dialog.getByLabel("Company Department Preset")
  await preset.click()
  await page.getByRole("option", { name: "Executive (EXEC)" }).click()
  await expect(name).toHaveValue("Executive")
  await expect(code).toHaveValue("EXEC")
  await expect(description).toHaveValue(
    "Executive leadership & strategic management",
  )
  await preset.click()
  await page.getByRole("option", { name: "Custom Department Name..." }).click()
  await expect(name).toHaveValue("")
  await expect(code).toHaveValue("")
  await expect(description).toHaveValue("")
  await name.fill("Executive")
  const automatic = autoDepartmentColor("Executive")
  const automaticLabel = automatic[0].toUpperCase() + automatic.slice(1)
  await expect(
    dialog.getByRole("radio", { name: automaticLabel }),
  ).toBeChecked()
  const manual = automatic === "blue" ? "Red" : "Blue"
  await dialog.getByRole("radio", { name: manual }).click()
  await name.fill("Another name")
  await expect(dialog.getByRole("radio", { name: manual })).toBeChecked()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole("button", { name: "Actions for Department 01" }).click()
  await page.getByRole("menuitem", { name: "Edit" }).click()
  await expect(name).toHaveValue("Department 01")
  await expect(code).toHaveValue("CODE-01")
  await expect(description).toHaveValue("Original note")
  const head = dialog.getByLabel("Department Head")
  await expect(head).toContainText("Current Head")
  await head.click()
  await page
    .getByRole("option", { name: "No Department Head Assigned" })
    .click()
  await name.fill("Updated department")
  await code.clear()
  await description.clear()
  const put = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      new URL(request.url()).pathname.endsWith(department.id),
  )
  try {
    await dialog.getByRole("button", { name: "Update Department" }).click()
    expect((await put).postDataJSON()).toEqual({
      name: "Updated department",
      color: "teal",
      code: null,
      description: null,
      headId: null,
    })
    await expect(dialog.getByRole("button", { name: /Saving/ })).toBeDisabled()
    expect(updates).toBe(1)
  } finally {
    saved.resolve()
  }
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Updated department", exact: true }),
  ).toBeVisible()
  expect(updates).toBe(1)
})

test("PG-021-F001-A008-T001 Head options are scoped and obsolete options stay hidden", async ({
  page,
}) => {
  const first = { ...departmentFixture(1), headId: "pg021-current" }
  const second = departmentFixture(2)
  const oldEntered = responseGate()
  const releaseOld = responseGate()
  const queries: string[] = []
  await restoreSession(page, "ADMIN", { initialDepartments: [first, second] })
  await page.route("**/api/departments/eligible-heads?**", async (route) => {
    const query = new URL(route.request().url()).search
    queries.push(query)
    if (query === "?new=true") {
      oldEntered.resolve()
      await releaseOld.promise
      await route
        .fulfill({
          json: {
            users: [{ id: "old", fullName: "Obsolete option", role: "STAFF" }],
          },
        })
        .catch(() => {})
    } else if (query.endsWith(first.id)) {
      await route.fulfill({
        json: {
          users: [
            { id: first.headId, fullName: "Current Head", role: "STAFF" },
          ],
        },
      })
    } else {
      await route.fulfill({ status: 503, json: { error: "Unavailable Heads" } })
    }
  })
  await page.goto("/departments")
  const dialog = page.getByRole("dialog")
  const head = dialog.getByLabel("Department Head")
  const openEdit = async (department: Department) => {
    await page
      .getByRole("button", { name: `Actions for ${department.name}` })
      .click()
    await page.getByRole("menuitem", { name: "Edit" }).click()
  }
  try {
    await page.getByRole("button", { name: "Create Department" }).click()
    await oldEntered.promise
    await expect(dialog.getByRole("status")).toContainText(
      "Loading eligible department heads",
    )
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toHaveCount(0)
    await openEdit(first)
    await expect(head).toContainText("Current Head")
  } finally {
    releaseOld.resolve()
  }
  await head.click()
  await expect(page.getByRole("option")).toHaveCount(2)
  await expect(
    page.getByRole("option", { name: "Obsolete option" }),
  ).toHaveCount(0)
  await page.keyboard.press("Escape")
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)
  await openEdit(second)
  await head.click()
  await expect(page.getByRole("option")).toHaveCount(1)
  await expect(
    page.getByRole("option", { name: "No Department Head Assigned" }),
  ).toBeVisible()
  expect(queries).toEqual([
    "?new=true",
    `?departmentId=${first.id}`,
    `?departmentId=${second.id}`,
  ])
})

test("PG-021-F001-A001-T001 portal entry enforces the management role boundary", async ({
  browser,
  baseURL,
}) => {
  for (const actor of [
    "ADMIN",
    "SUPERADMIN",
    "USER",
    "STAFF",
    "Head",
    "anonymous",
  ] as const) {
    const context = await browser.newContext({ baseURL })
    try {
      const actorPage = await context.newPage()
      const permitted = actor === "ADMIN" || actor === "SUPERADMIN"
      if (actor !== "anonymous") {
        await restoreSession(actorPage, actor === "Head" ? "STAFF" : actor, {
          account:
            actor === "Head"
              ? {
                  departmentId: "qa-department",
                  headOf: { id: "qa-department", name: "QA Department" },
                }
              : undefined,
        })
      }
      let reads = 0
      actorPage.on("request", (request) => {
        if (
          request.method() === "GET" &&
          new URL(request.url()).pathname === "/api/departments"
        )
          reads++
      })
      for (const visit of [0, 1]) {
        if (visit === 0 || !permitted) await actorPage.goto("/departments")
        else await actorPage.reload()
        const heading = actorPage.getByRole("heading", {
          name: "Department Management",
          exact: true,
        })
        if (permitted) {
          await expect(heading).toBeVisible()
          await expect.poll(() => reads).toBe(visit + 1)
          await expect(
            actorPage.getByRole("link", { name: "Department Management" }),
          ).toBeVisible()
        } else {
          await expect(actorPage).not.toHaveURL(/\/departments$/)
          await expect(heading).toHaveCount(0)
          await expect(
            actorPage.getByRole("link", { name: "Department Management" }),
          ).toHaveCount(0)
          expect(reads).toBe(0)
        }
      }
    } finally {
      await context.close()
    }
  }
})

test("PG-021-F001-A023-T001 deletion confirmation, pending state and recovery", async ({
  page,
}) => {
  const department = departmentFixture(1)
  const departments = [department]
  let writes = 0
  const entered = responseGate()
  const rejectFirst = responseGate()
  await restoreSession(page, "ADMIN", { initialDepartments: departments })
  await page.route("**/api/departments", (route) =>
    route.fulfill({ json: { departments } }),
  )
  await page.route(`**/api/departments/${department.id}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback()
    writes++
    if (writes === 1) {
      entered.resolve()
      await rejectFirst.promise
      return route.fulfill({
        status: 409,
        json: { error: "QA department has linked work" },
      })
    }
    departments.length = 0
    return route.fulfill({
      json: { message: "Department deleted successfully" },
    })
  })
  await page.goto("/departments")
  const opener = page.getByRole("button", { name: "Actions for Department 01" })
  const dialog = page.getByRole("dialog", { name: "Delete department?" })
  const open = async () => {
    await opener.click()
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
    await expect(dialog).toContainText(department.name)
  }
  await open()
  await expect(dialog).toContainText(
    "1 member will be unassigned; their accounts are kept.",
  )
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toBe(0)
  await open()
  try {
    await dialog.getByRole("button", { name: "Delete department" }).click()
    await entered.promise
    await expect(
      dialog.getByRole("button", { name: "Deleting..." }),
    ).toBeDisabled()
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled()
  } finally {
    rejectFirst.resolve()
  }
  await expect(dialog).toContainText("QA department has linked work")
  await expect(opener).toBeVisible()
  await dialog.getByRole("button", { name: "Delete department" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toHaveCount(0)
  await expect(page.getByText("No departments created yet.")).toBeVisible()
  expect(writes).toBe(2)
})

test("PG-021-F001-A002-T001 directory loading, error, empty and retained rows on reload", async ({
  page,
}) => {
  const firstEntered = responseGate()
  const failFirst = responseGate()
  const reloadEntered = responseGate()
  const finishReload = responseGate()
  let reads = 0
  await restoreSession(page, "ADMIN")
  await page.route("**/api/departments", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        json: { department: departmentFixture(2) },
      })
    }
    reads++
    if (reads === 1 || reads === 3) {
      if (reads === 1) {
        firstEntered.resolve()
        await failFirst.promise
      }
      return route.fulfill({
        status: 500,
        json: { error: "QA directory unavailable" },
      })
    }
    if (reads === 5) {
      reloadEntered.resolve()
      await finishReload.promise
    }
    const departments =
      reads === 2
        ? []
        : reads === 4
          ? [departmentFixture(1)]
          : [departmentFixture(1), departmentFixture(2)]
    return route.fulfill({ json: { departments } })
  })
  await page.goto("/departments")
  const busy = page
    .getByLabel("Departments", { exact: true })
    .locator("[aria-busy=true]")
  try {
    await firstEntered.promise
    await expect(busy).toHaveCount(1)
  } finally {
    failFirst.resolve()
  }
  await expect(page.getByText("QA directory unavailable")).toBeVisible()
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("No departments created yet.")).toBeVisible()
  await page.reload()
  await expect(page.getByText("QA directory unavailable")).toBeVisible()
  await page.getByRole("button", { name: "Try again" }).click()
  const first = page.getByRole("button", { name: "Department 01", exact: true })
  await expect(first).toBeVisible()
  await page.getByRole("button", { name: "Create Department" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Department Name").fill("Department 02")
  try {
    await dialog.getByRole("button", { name: "Create Department" }).click()
    await reloadEntered.promise
    await expect(busy).toHaveCount(1)
    await expect(first).toBeVisible()
  } finally {
    finishReload.resolve()
  }
  await expect(
    page.getByRole("button", { name: "Department 02", exact: true }),
  ).toBeVisible()
})

test("PG-021-F001-A004-T001 directory sort, search limit and navigation state", async ({
  page,
}) => {
  const departments = Array.from({ length: 12 }, (_, index) =>
    departmentFixture(index + 1),
  )
  await restoreSession(page, "ADMIN", { initialDepartments: departments })
  await page.goto("/departments")
  const first = page.getByRole("rowheader").first()
  const search = page.getByRole("searchbox", { name: "Search departments" })
  await expect(first).toContainText("Department 01")
  await page.getByRole("button", { name: "Sort by Employees" }).click()
  await expect(first).toContainText("Department 12")
  await page.getByRole("button", { name: "Sort by Employees" }).click()
  await expect(first).toContainText("Department 01")
  await page.getByRole("button", { name: "Sort by Teams" }).click()
  await expect(first).toContainText("Department 03")
  await page.getByRole("button", { name: "Sort by Services" }).click()
  await expect(first).toContainText("Department 02")
  await search.fill("x".repeat(101))
  await expect(search).toHaveValue("x".repeat(100))
  await expect(page.getByRole("rowheader")).toHaveCount(0)
  await search.clear()
  await expect(first).toContainText("Department 02")
  await search.fill("CODE-12")
  await expect(first).toContainText("Department 12")
  await page.goto("/")
  await page.goBack()
  await expect(search).toHaveValue("")
  await expect(first).toContainText("Department 01")
  await search.fill("CODE-12")
  await page.reload()
  await expect(search).toHaveValue("")
  await expect(first).toContainText("Department 01")
})

for (const width of [1440, 390]) {
  test(`PG-021-F001-A005-T001 keyboard access and focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await restoreSession(page, "ADMIN", {
      initialDepartments: [departmentFixture(1)],
    })
    await page.goto("/departments")
    const trigger = page.getByRole("button", {
      name: "Actions for Department 01",
    })
    for (const name of ["View Department", "Edit", "Delete"]) {
      await trigger.focus()
      await page.keyboard.press("Enter")
      await expect(trigger).toHaveAttribute("aria-expanded", "true")
      const action = page.getByRole("menuitem", { name, exact: true })
      await expect(action).toBeVisible()
      for (
        let index = 0;
        index < ["View Department", "Edit", "Delete"].indexOf(name);
        index++
      ) {
        await page.keyboard.press("ArrowDown")
      }
      await expect(action).toBeFocused()
      await page.keyboard.press("Enter")
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      await expect(dialog.locator(":focus")).toHaveCount(1)
      await page.keyboard.press("Escape")
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
  })
}

test("PG-021-F001-A030-T001 renders department text literally", async ({
  page,
}) => {
  const name = "<qa-marker>Literal department</qa-marker>"
  const department = { ...departmentFixture(1), name }
  await restoreSession(page, "ADMIN", { initialDepartments: [department] })
  await page.route(`**/api/departments/${department.id}`, (route) =>
    route.fulfill({
      json: { department: { ...department, members: [], teams: [] } },
    }),
  )
  await page.goto("/departments")
  await expect(page.getByRole("rowheader")).toContainText(name)
  await page.getByRole("button", { name, exact: true }).click()
  await expect(
    page.getByRole("dialog").getByText(name, { exact: true }).first(),
  ).toBeVisible()
  await expect(page.locator("qa-marker")).toHaveCount(0)
})

test.describe("Department Management page regressions", () => {
  test("department directory filters by code, sorts by employee count, and resets pagination", async ({
    page,
  }) => {
    const departments = Array.from({ length: 12 }, (_, index) =>
      departmentFixture(index + 1),
    )
    await restoreSession(page, "ADMIN", { initialDepartments: departments })
    await page.goto("/departments")

    await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 12")
    await page
      .getByRole("navigation", { name: "Department pages" })
      .getByRole("button", { name: "Next page" })
      .click()
    await expect(page.getByRole("status")).toHaveText("Showing 11–12 of 12")
    await expect(
      page.getByRole("button", { name: "Department 11", exact: true }),
    ).toBeVisible()

    const search = page.getByRole("searchbox", {
      name: "Search departments",
    })
    await search.fill("CODE-12")
    await expect(page.getByRole("status")).toHaveText("Showing 1–1 of 1")
    await expect(
      page.getByRole("button", { name: "Department 12", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Department 11", exact: true }),
    ).toHaveCount(0)

    await search.clear()
    await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 12")
    await page.getByRole("button", { name: "Sort by Employees" }).click()
    await expect(page.getByRole("status")).toHaveText("Showing 1–10 of 12")
    await expect(page.getByRole("rowheader").first()).toContainText(
      "Department 12",
    )
  })

  test("Project Management department directory restores a valid URL page and clamps an invalid page", async ({
    page,
  }) => {
    const departments = Array.from({ length: 12 }, (_, index) =>
      departmentFixture(index + 1),
    )
    await restoreSession(page, "SUPERADMIN")
    await page.route(
      "**/api/departments/project-management-directory",
      (route) => route.fulfill({ json: { departments } }),
    )

    await page.goto("/project-management?search=CODE&page=2")
    const pagination = page.getByRole("navigation", {
      name: "Department pages",
    })
    const secondPage = pagination.getByRole("button", {
      name: "Page 2",
      exact: true,
    })
    await expect(secondPage).toHaveAttribute("aria-current", "page")
    await page.reload()
    await expect(secondPage).toHaveAttribute("aria-current", "page")
    await expect(page).toHaveURL(/search=CODE&page=2$/)

    await page.goto("/project-management?search=CODE&page=99")
    await expect(secondPage).toHaveAttribute("aria-current", "page")
    await expect(page).toHaveURL(/search=CODE&page=2$/)
    await page
      .getByRole("searchbox", { name: "Search departments" })
      .fill("CODE-12")
    await expect(page).toHaveURL(/search=CODE-12$/)
    await expect(secondPage).toHaveCount(0)
  })

  test("department creation reports name boundaries and recovers from validation and uniqueness errors", async ({
    page,
  }) => {
    let directoryReads = 0
    const departments: Department[] = []
    const createBodies: {
      name: string
      color: Department["color"]
      code?: string
      description?: string
      headId?: string | null
    }[] = []
    await restoreSession(page, "ADMIN", { initialDepartments: departments })
    await page.route("**/api/departments**", async (route) => {
      const request = route.request()
      const url = new URL(request.url())

      if (
        url.pathname === "/api/departments/eligible-heads" &&
        request.method() === "GET"
      ) {
        await route.fulfill({ json: { users: [] } })
        return
      }
      if (url.pathname === "/api/departments" && request.method() === "GET") {
        directoryReads += 1
        await route.fulfill({ json: { departments } })
        return
      }
      if (url.pathname === "/api/departments" && request.method() === "POST") {
        const body = request.postDataJSON() as {
          name: string
          color: Department["color"]
          code?: string
          description?: string
          headId?: string | null
        }
        createBodies.push(body)
        if (body.name.length < 2 || body.name.length > 80) {
          await route.fulfill({
            status: 400,
            json: {
              error: "Department name must be between 2 and 80 characters",
            },
          })
          return
        }
        if (
          body.name === "Operations" &&
          createBodies.filter((item) => item.name === "Operations").length === 1
        ) {
          await route.fulfill({
            status: 409,
            json: { error: "Department name or code already exists" },
          })
          return
        }

        const created: Department = {
          id: "department-created",
          name: body.name,
          code: body.code ?? null,
          color: body.color,
          description: body.description ?? null,
          headId: body.headId ?? null,
          head: null,
          memberCount: 0,
          teamCount: 0,
          serviceCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }
        departments.push(created)
        await route.fulfill({ status: 201, json: { department: created } })
        return
      }

      await route.fallback()
    })

    const initialDirectory = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/departments" &&
        response.request().method() === "GET",
    )
    await page.goto("/departments")
    await (await initialDirectory).finished()
    const initialReads = directoryReads
    await page.getByRole("button", { name: "Create Department" }).click()
    const dialog = page.getByRole("dialog")
    const name = dialog.getByLabel("Department Name")
    const code = dialog.getByLabel("Department Code")
    const description = dialog.getByLabel("Description")
    const submit = dialog.getByRole("button", {
      name: "Create Department",
      exact: true,
    })

    await name.fill("   ")
    await submit.click()
    await expect(
      dialog.getByText("Please enter a department name", { exact: true }),
    ).toBeVisible()
    expect(createBodies).toHaveLength(0)

    await name.fill("A")
    const shortNamePost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await shortNamePost).postDataJSON()).toMatchObject({ name: "A" })
    await expect(
      dialog.getByText("Department name must be between 2 and 80 characters", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(name).toHaveValue("A")

    const longName = "N".repeat(81)
    await name.fill(longName)
    const longNamePost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await longNamePost).postDataJSON()).toMatchObject({
      name: longName,
    })
    await expect(
      dialog.getByText("Department name must be between 2 and 80 characters", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(name).toHaveValue(longName)

    await name.fill("  Operations  ")
    await code.fill(" ops ")
    await description.fill("  Coordinates internal teams  ")
    const firstPost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await firstPost).postDataJSON()).toMatchObject({
      name: "Operations",
      code: "OPS",
      description: "Coordinates internal teams",
    })
    await expect(createBodies).toHaveLength(3)
    await expect(
      dialog.getByText("Department name or code already exists", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(name).toHaveValue("  Operations  ")
    await expect(code).toHaveValue(" OPS ")
    // PG-021-F001-A031-T001
    expect(directoryReads).toBe(initialReads)

    await code.fill(" ops2 ")
    const retryPost = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/departments",
    )
    await submit.click()
    expect((await retryPost).postDataJSON()).toMatchObject({
      name: "Operations",
      code: "OPS2",
      description: "Coordinates internal teams",
    })
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Operations", exact: true }),
    ).toBeVisible()
    expect(createBodies).toHaveLength(4)
    expect(directoryReads).toBe(initialReads + 1)
  })
})
