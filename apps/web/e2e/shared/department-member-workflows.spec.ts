import { expect, test } from "@playwright/test"
import type {
  DepartmentDetail,
  DepartmentMember,
  DepartmentTeam,
} from "../../src/features/departments/api/departments-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

import { responseGate } from "../support/pg021-response-gate"

configureRegressionTest()

function qaMember(
  name: string,
  id: string,
  departmentId: string,
): DepartmentMember {
  return {
    id,
    userId: `${id}-user`,
    fullName: name,
    email: `${id}@example.test`,
    contactNumber: null,
    position: "Engineer",
    status: "ACTIVE",
    departmentId,
    teamId: null,
    team: null,
    createdAt: "2026-11-10T08:00:00.000Z",
    user: {
      id: `${id}-user`,
      email: `${id}@example.test`,
      fullName: name,
      role: "STAFF",
      isActive: true,
      accountDeletedAt: null,
    },
  }
}

function qaDetail(
  id: string,
  name: string,
  members: DepartmentMember[],
  teams: DepartmentTeam[] = [],
): DepartmentDetail {
  return {
    id,
    name,
    code: null,
    color: "teal",
    description: null,
    headId: null,
    head: null,
    memberCount: members.length,
    teamCount: teams.length,
    serviceCount: 0,
    createdAt: "2026-11-10T08:00:00.000Z",
    updatedAt: "2026-11-10T08:00:00.000Z",
    members,
    teams,
  }
}

function qaCandidate(member: DepartmentMember) {
  return {
    id: member.userId,
    fullName: member.fullName,
    email: member.email,
    contactNumber: null,
    position: member.position,
    departmentId: null,
    user: member.user,
  }
}

test("PG-021-F001-A014-T001 drawer loading, retry, search and record isolation", async ({
  page,
}) => {
  const member = {
    ...qaMember("QA Member", "qa-member", "qa-first"),
    teamId: "qa-team",
    team: { id: "qa-team", name: "QA Crew" },
  }
  const first = qaDetail("qa-first", "First QA", [member])
  const second = qaDetail("qa-second", "Second QA", [])
  const ready = responseGate()
  let reads = 0
  await restoreSession(page, "ADMIN", { initialDepartments: [first, second] })
  await page.route("**/api/departments/qa-first", async (route) => {
    if (++reads === 1) {
      await ready.promise
      return route.fulfill({
        status: 503,
        json: { error: "QA detail unavailable" },
      })
    }
    return route.fulfill({ json: { department: first } })
  })
  await page.route("**/api/departments/qa-second", (route) =>
    route.fulfill({ json: { department: second } }),
  )
  await page.goto("/departments")
  try {
    await page.getByRole("button", { name: first.name, exact: true }).click()
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Loading department",
    )
  } finally {
    ready.resolve()
  }
  await expect(page.getByText("QA detail unavailable")).toBeVisible()
  await page.getByRole("button", { name: "Try again" }).click()
  const region = page.getByRole("region", { name: "Current members" })
  const search = page.getByRole("searchbox", { name: "Search members" })
  for (const query of [
    "QA Member",
    "qa-member@example.test",
    "Engineer",
    "QA Crew",
  ]) {
    await search.fill(query)
    await expect(region).toContainText("QA Member")
  }
  await search.fill("missing")
  await expect(region).toContainText("No members match your search.")
  await page.getByRole("tab", { name: "Teams" }).click()
  await expect(
    page.getByText("No teams created in this department yet."),
  ).toBeVisible()
  await page.getByRole("button", { name: "Close drawer" }).click()
  await page.getByRole("button", { name: second.name, exact: true }).click()
  await expect(region).toContainText(
    "No members assigned to this department yet.",
  )
  await expect(region).not.toContainText("QA Member")

  await page.getByRole("button", { name: "Close drawer" }).click()
  await restoreSession(page, "ADMIN", {
    initialDepartments: [first, second],
    account: { permissions: ["departments:read", "employees:read"] },
  })
  await page.route("**/api/departments/qa-first", (route) =>
    route.fulfill({ json: { department: first } }),
  )
  await page.reload()
  await page.getByRole("button", { name: first.name, exact: true }).click()
  await expect(region).toContainText("QA Member")
  await expect(
    region.getByRole("button", { name: "Edit QA Member" }),
  ).toHaveCount(0)
})

test("PG-021-F001-A015-T001 candidate pagination and stale result suppression", async ({
  page,
}) => {
  const current = qaMember("Current member", "qa-current", "qa-dept")
  const detail = qaDetail("qa-dept", "QA Department", [current])
  const entered = responseGate()
  const release = responseGate()
  const requests: string[] = []
  let failures = 0
  await restoreSession(page, "ADMIN", { initialDepartments: [detail] })
  await page.route("**/api/departments/qa-dept", (route) =>
    route.fulfill({ json: { department: detail } }),
  )
  await page.route("**/api/departments/employee-options?**", async (route) => {
    const params = new URL(route.request().url()).searchParams
    const query = params.get("search") ?? ""
    const pageNumber = Number(params.get("page") ?? 1)
    requests.push(`${query}:${pageNumber}`)
    if (query === "old") {
      entered.resolve()
      await release.promise
    }
    if (query === "retry" && failures++ === 0)
      return route.fulfill({
        status: 503,
        json: { error: "QA candidate failure" },
      })
    const name =
      query === "old"
        ? "Obsolete candidate"
        : query === "retry"
          ? "Recovered candidate"
          : pageNumber === 2
            ? "Page two candidate"
            : "Page one candidate"
    return route.fulfill({
      json: {
        employees: [
          qaCandidate(current),
          qaCandidate(qaMember(name, "qa-next", "qa-dept")),
        ],
        page: pageNumber,
        pageSize: 10,
        total: 11,
      },
    })
  })
  await page.goto("/departments")
  await page.getByRole("button", { name: detail.name, exact: true }).click()
  await page.getByRole("button", { name: "Assign", exact: true }).click()
  const search = page.getByRole("searchbox", {
    name: "Search employees to assign",
  })
  try {
    await search.fill("old")
    await entered.promise
    await search.fill("new")
    await expect(
      page.getByRole("button", { name: "Assign Page one candidate" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Assign Page two candidate" }),
    ).toBeVisible()
  } finally {
    const obsolete = page.waitForResponse(
      (response) =>
        new URL(response.url()).searchParams.get("search") === "old",
    )
    release.resolve()
    await (await obsolete).finished()
  }
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Assign Page two candidate" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Assign Obsolete candidate" }),
  ).toHaveCount(0)
  await expect
    .soft(page.getByRole("button", { name: "Assign Current member" }))
    .toHaveCount(0)
  await search.fill("retry")
  await expect(page.getByText("QA candidate failure")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect(
    page.getByRole("button", { name: "Assign Recovered candidate" }),
  ).toBeVisible()
  await expect(search).toHaveValue("retry")
  expect(requests.slice(-2)).toEqual(["retry:1", "retry:1"])
})

test("PG-021-F001-A017-T001 assign and remove department members", async ({
  page,
}) => {
  const added = qaMember("QA Assigned", "qa-added", "qa-dept")
  const denied = qaMember("QA Denied", "qa-denied", "qa-dept")
  const members: DepartmentMember[] = []
  const detail = () => qaDetail("qa-dept", "QA Department", members)
  const pending = responseGate()
  let posts = 0
  let deletes = 0
  let reads = 0
  await restoreSession(page, "ADMIN", { initialDepartments: [detail()] })
  await page.route("**/api/departments", (route) => {
    reads++
    return route.fulfill({ json: { departments: [detail()] } })
  })
  await page.route("**/api/departments/qa-dept", (route) =>
    route.fulfill({ json: { department: detail() } }),
  )
  await page.route("**/api/departments/employee-options?**", (route) =>
    route.fulfill({
      json: {
        employees: [qaCandidate(added), qaCandidate(denied)],
        page: 1,
        pageSize: 10,
        total: 2,
      },
    }),
  )
  await page.route("**/api/departments/qa-dept/members", async (route) => {
    posts++
    if (posts === 1) {
      expect(route.request().postDataJSON()).toEqual({
        userIds: [added.userId],
      })
      await pending.promise
      members.push(added)
      return route.fulfill({
        json: { message: "Members assigned successfully", members },
      })
    }
    return route.fulfill({
      status: 400,
      json: { error: "QA assignment denied" },
    })
  })
  await page.route("**/api/departments/qa-dept/members/qa-added", (route) => {
    expect(route.request().method()).toBe("DELETE")
    deletes++
    members.length = 0
    return route.fulfill({
      json: { message: "Employee removed from department" },
    })
  })
  await page.goto("/departments")
  await page.getByRole("button", { name: "QA Department", exact: true }).click()
  const region = page.getByRole("region", { name: "Current members" })
  const assign = region.getByRole("button", { name: "Assign", exact: true })
  await assign.click()
  const add = page.getByRole("button", {
    name: "Assign QA Assigned",
    exact: true,
  })
  const initialReads = reads
  try {
    await add.click()
    await expect(add).toBeDisabled()
    expect(posts).toBe(1)
  } finally {
    pending.resolve()
  }
  await expect(region).toContainText("QA Assigned")
  await expect.poll(() => reads).toBe(initialReads + 1)
  await assign.click()
  await page
    .getByRole("button", { name: "Assign QA Denied", exact: true })
    .click()
  await expect.soft(page.getByText("QA assignment denied")).toBeVisible()
  await page
    .getByRole("button", { name: "Back to members", exact: true })
    .click()
  const remove = page.getByRole("button", {
    name: "Remove QA Assigned from department",
  })
  await remove.click()
  await region.getByRole("button", { name: "Cancel" }).click()
  expect(deletes).toBe(0)
  await remove.click()
  await region.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(region).not.toContainText("QA Assigned")
  expect(deletes).toBe(1)
})

test("PG-021-F001-A019-T001 edit member position, clear placement and recover", async ({
  page,
}) => {
  const member: DepartmentMember = {
    ...qaMember("QA Member", "qa-member", "qa-dept"),
    teamId: "qa-team",
    team: { id: "qa-team", name: "QA Crew" },
  }
  const team: DepartmentTeam = {
    id: "qa-team",
    name: "QA Crew",
    description: null,
    leadId: null,
    lead: null,
    memberCount: 1,
    departmentId: "qa-dept",
    createdAt: member.createdAt,
    updatedAt: member.createdAt,
  }
  const detail = () => qaDetail("qa-dept", "QA Department", [member], [team])
  let writes = 0
  await restoreSession(page, "ADMIN", { initialDepartments: [detail()] })
  await page.route("**/api/departments/qa-dept", (route) =>
    route.fulfill({ json: { department: detail() } }),
  )
  await page.route(
    "**/api/departments/qa-dept/members/qa-member",
    async (route) => {
      expect(route.request().method()).toBe("PATCH")
      expect(route.request().postDataJSON()).toEqual({
        position: "Senior Engineer",
        teamId: null,
      })
      if (++writes === 1)
        return route.fulfill({
          status: 409,
          json: { error: "QA member conflict" },
        })
      member.position = "Senior Engineer"
      member.teamId = null
      member.team = null
      return route.fulfill({ json: { employee: member } })
    },
  )
  await page.goto("/departments")
  await page.getByRole("button", { name: "QA Department", exact: true }).click()
  const opener = page.getByRole("button", { name: "Edit QA Member" })
  await opener.click()
  const position = page.getByLabel("Job title / position")
  const assignedTeam = page.getByRole("combobox", { name: "Assigned team" })
  await expect(position).toHaveValue("Engineer")
  await expect(assignedTeam).toContainText("QA Crew")
  await assignedTeam.click()
  await page.getByRole("option", { name: "No specific team" }).click()
  await position.fill("Senior Engineer")
  const save = page.getByRole("button", { name: "Save details" })
  await save.click()
  await expect(page.getByText("QA member conflict")).toBeVisible()
  await expect(position).toHaveValue("Senior Engineer")
  await save.click()
  await expect(
    page.getByRole("region", { name: "Current members" }),
  ).toContainText("Senior Engineer")
  await expect(opener).toBeFocused()
  expect(writes).toBe(2)
})

test("PG-021-F001-A021-T001 team selection, partial removal and delete", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const timestamp = "2026-11-10T08:00:00.000Z"
  const members: DepartmentMember[] = ["Avery", "Blake", "Casey"].map(
    (name, index) => ({
      id: `pg021-employee-${index}`,
      userId: `pg021-staff-${index}`,
      fullName: name,
      email: `${name}@example.test`,
      contactNumber: null,
      position: "Engineer",
      status: index === 2 ? "ON_LEAVE" : "ACTIVE",
      departmentId: "dept-1",
      teamId: null,
      team: null,
      createdAt: timestamp,
      user: {
        id: `pg021-staff-${index}`,
        email: `${name}@example.test`,
        fullName: name,
        role: "STAFF",
        isActive: true,
        accountDeletedAt: null,
      },
    }),
  )
  const team: DepartmentTeam = {
    id: "pg021-team",
    name: "QA team",
    description: null,
    departmentId: "dept-1",
    leadId: null,
    lead: null,
    memberCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  let created = false
  let deletes = 0
  const patches: string[] = []
  const releaseFirst = responseGate()
  const firstEntered = responseGate()

  await page.route("**/api/departments/dept-1", (route) =>
    route.fulfill({
      json: {
        department: {
          id: "dept-1",
          name: "Engineering",
          code: "ENG",
          color: "teal",
          description: null,
          headId: null,
          head: null,
          memberCount: members.length,
          teamCount: Number(created),
          serviceCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          members: members.map((member) => ({
            ...member,
            team: member.teamId ? { id: team.id, name: team.name } : null,
          })),
          teams: created
            ? [
                {
                  ...team,
                  memberCount: members.filter((member) => member.teamId).length,
                },
              ]
            : [],
        },
      },
    }),
  )
  await page.route("**/api/departments/dept-1/teams", async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    expect(route.request().postDataJSON()).toMatchObject({
      name: team.name,
      memberIds: [members[0].id, members[1].id],
    })
    created = true
    for (const member of members.slice(0, 2)) member.teamId = team.id
    await route.fulfill({ status: 201, json: { team } })
  })
  await page.route("**/api/departments/dept-1/members/**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback()
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!
    expect(route.request().postDataJSON()).toEqual({ teamId: null })
    patches.push(id)
    if (patches.length === 1) {
      firstEntered.resolve()
      await releaseFirst.promise
      const member = members.find((item) => item.id === id)!
      member.teamId = null
      return route.fulfill({ json: { employee: member } })
    }
    return route.fulfill({
      status: 409,
      json: { error: "QA placement conflict" },
    })
  })
  await page.route(
    "**/api/departments/dept-1/teams/pg021-team",
    async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback()
      deletes++
      created = false
      for (const member of members) member.teamId = null
      await route.fulfill({ json: { message: "Team deleted successfully" } })
    },
  )

  await page.goto("/departments")
  await page.getByRole("button", { name: "Engineering", exact: true }).click()
  await page.getByRole("tab", { name: /Teams/ }).click()
  await page.getByRole("button", { name: "Create Team", exact: true }).click()
  const candidates = page.getByRole("list", { name: "Available team members" })
  await expect(candidates).not.toContainText("Casey")
  await page.getByLabel("Team name", { exact: true }).fill(team.name)
  for (const name of ["Avery", "Blake"]) {
    await candidates
      .getByRole("listitem")
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByRole("button", { name: "Add", exact: true })
      .click()
  }
  await page.getByRole("button", { name: "Save team" }).click()
  const card = page.getByRole("region", { name: "QA team team" })
  const menu = card.getByRole("button", { name: "Manage QA team team" })
  await menu.click()
  await page.getByRole("menuitem", { name: "Remove members" }).click()
  const search = page.getByPlaceholder("Search name, email, or position")
  await search.fill("Blake")
  await expect(page.getByRole("checkbox", { name: /Avery/ })).toHaveCount(0)
  await search.clear()
  for (const name of ["Avery", "Blake"]) {
    await page
      .getByRole("checkbox", { name: new RegExp(name) })
      .locator("xpath=..")
      .click()
  }
  try {
    await page.getByRole("button", { name: "Remove 2", exact: true }).click()
    await firstEntered.promise
    expect(patches).toEqual([members[0].id])
    await expect(search).toBeDisabled()
  } finally {
    releaseFirst.resolve()
  }
  await expect(page.getByText("QA placement conflict")).toBeVisible()
  expect(patches).toEqual([members[0].id, members[1].id])
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(card).not.toContainText("Avery")
  await expect(card).toContainText("Blake")
  await menu.click()
  await page.getByRole("menuitem", { name: "Delete team" }).click()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(deletes).toBe(0)
  await menu.click()
  await page.getByRole("menuitem", { name: "Delete team" }).click()
  await page.getByRole("button", { name: "Delete team", exact: true }).click()
  await expect(card).toHaveCount(0)
  expect(deletes).toBe(1)
})

test("[NEX-011] admin creates a team, assigns an employee, and removes the assignment", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")

  const timestamp = "2026-11-10T08:00:00.000Z"
  const members: DepartmentMember[] = [
    {
      id: "employee-1",
      userId: "staff-1",
      fullName: "Avery Designer",
      email: "avery@example.com",
      contactNumber: null,
      position: "Designer",
      status: "ACTIVE",
      departmentId: "dept-1",
      teamId: null,
      team: null,
      createdAt: timestamp,
      user: {
        id: "staff-1",
        email: "avery@example.com",
        fullName: "Avery Designer",
        role: "STAFF",
        isActive: true,
        accountDeletedAt: null,
      },
    },
    {
      id: "employee-2",
      userId: "staff-2",
      fullName: "Blake Engineer",
      email: "blake@example.com",
      contactNumber: null,
      position: "Engineer",
      status: "ACTIVE",
      departmentId: "dept-1",
      teamId: null,
      team: null,
      createdAt: timestamp,
      user: {
        id: "staff-2",
        email: "blake@example.com",
        fullName: "Blake Engineer",
        role: "STAFF",
        isActive: true,
        accountDeletedAt: null,
      },
    },
  ]
  const teams: DepartmentTeam[] = []
  const writes: { method: string; path: string; body: unknown }[] = []

  function detail(): DepartmentDetail {
    return {
      id: "dept-1",
      name: "Engineering",
      code: "ENG",
      color: "teal",
      description: null,
      headId: null,
      head: null,
      memberCount: members.length,
      teamCount: teams.length,
      serviceCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      members: members.map((member) => ({
        ...member,
        team: teams.find((team) => team.id === member.teamId)
          ? {
              id: member.teamId!,
              name: teams.find((team) => team.id === member.teamId)!.name,
            }
          : null,
      })),
      teams: teams.map((team) => ({
        ...team,
        memberCount: members.filter((member) => member.teamId === team.id)
          .length,
      })),
    }
  }

  await page.route("**/api/departments/employee-options**", (route) =>
    route.fulfill({
      json: { employees: [], total: 0, page: 1, pageSize: 10 },
    }),
  )
  await page.route("**/api/departments/dept-1", (route) =>
    route.fulfill({ json: { department: detail() } }),
  )
  await page.route("**/api/departments/dept-1/teams", async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    const input = route.request().postDataJSON() as {
      name: string
      description?: string
      memberIds?: string[]
    }
    writes.push({
      method: "POST",
      path: "/api/departments/dept-1/teams",
      body: input,
    })
    const team: DepartmentTeam = {
      id: "team-nex011",
      name: input.name,
      description: input.description ?? null,
      departmentId: "dept-1",
      leadId: null,
      lead: null,
      memberCount: input.memberIds?.length ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    teams.push(team)
    for (const member of members)
      if (input.memberIds?.includes(member.id)) member.teamId = team.id
    return route.fulfill({ status: 201, json: { team } })
  })
  await page.route("**/api/departments/dept-1/members/**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback()
    const { pathname } = new URL(route.request().url())
    const employeeId = pathname.split("/").at(-1)
    const input = route.request().postDataJSON() as { teamId: string | null }
    writes.push({ method: "PATCH", path: pathname, body: input })
    const member = members.find((item) => item.id === employeeId)
    if (!member)
      return route.fulfill({
        status: 404,
        json: { error: "Employee not found" },
      })
    member.teamId = input.teamId
    return route.fulfill({ json: { success: true } })
  })

  await page.goto("/departments")
  await page.getByRole("button", { name: "Engineering", exact: true }).click()
  await page.getByRole("tab", { name: /Teams/ }).click()
  await page.getByRole("button", { name: "Create Team", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Create team", exact: true }),
  ).toBeVisible()
  await page.getByLabel("Team name", { exact: true }).fill("Design team")
  const availableMembers = page.getByRole("list", {
    name: "Available team members",
  })
  await availableMembers
    .getByRole("button", { name: "Add", exact: true })
    .first()
    .click()
  await page.getByRole("button", { name: "Save team" }).click()

  const team = page.getByRole("region", { name: "Design team team" })
  await expect(team).toContainText("Avery Designer")
  expect(writes[0]).toMatchObject({
    method: "POST",
    body: { name: "Design team", memberIds: ["employee-1"] },
  })

  await team.getByRole("button", { name: "Manage Design team team" }).click()
  await page.getByRole("menuitem", { name: "Assign members" }).click()
  await page
    .getByRole("button", { name: "Assign Blake Engineer to Design team" })
    .click()
  const teamMembers = page
    .getByRole("tabpanel", { name: "Teams" })
    .getByRole("list", { name: "Design team members" })
  await expect(teamMembers).toContainText("Blake Engineer")
  expect(writes[1]).toMatchObject({
    method: "PATCH",
    path: "/api/departments/dept-1/members/employee-2",
    body: { teamId: "team-nex011" },
  })

  await team.getByRole("button", { name: "Manage Design team team" }).click()
  await page.getByRole("menuitem", { name: "Remove members" }).click()
  await expect(
    page.getByRole("heading", { name: "Remove members", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("checkbox", { name: /Blake Engineer/ })
    .locator("xpath=..")
    .click()
  await page.getByRole("button", { name: "Remove 1", exact: true }).click()
  await expect(teamMembers).not.toContainText("Blake Engineer")
  await expect(team).toContainText("Avery Designer")
  await expect(team).not.toContainText("Blake Engineer")
  expect(writes[2]).toMatchObject({
    method: "PATCH",
    path: "/api/departments/dept-1/members/employee-2",
    body: { teamId: null },
  })
})
