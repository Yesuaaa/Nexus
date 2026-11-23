import { expect, test } from "@playwright/test"
import type {
  DepartmentDetail,
  DepartmentMember,
  DepartmentTeam,
} from "../../src/features/departments/api/departments-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

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
