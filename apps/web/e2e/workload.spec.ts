import { expect, test, type Page } from "@playwright/test"
import type {
  EmployeeWorkload,
  Metrics,
  Staffing,
} from "../src/features/workload/api/workload-api"

const department = { id: "design", name: "Design" }
const metrics: Metrics = {
  scheduledHours: 35,
  blockedHours: 0,
  capacityHours: 35,
  allocatedHours: 7,
  remainingHours: 28,
  utilization: 20,
  status: "PARTIALLY_AVAILABLE",
  workload: "AVAILABLE",
  conflicts: [],
  scheduleConfigured: true,
  activeAssignments: 0,
  upcomingAssignments: 1,
  assignmentCount: 1,
  pendingAssignments: 1,
}
async function setup(page: Page, authorized = true) {
  let employees: EmployeeWorkload[] = [
    {
      ...metrics,
      id: "alice",
      employeeId: "EXP-001",
      fullName: "Alice Designer",
      position: "Designer",
      employmentType: "FULL_TIME",
      employeeStatus: "ACTIVE",
      skills: ["design"],
      department,
    },
    {
      ...metrics,
      id: "bob",
      employeeId: "EXP-002",
      fullName: "Bob Developer",
      position: "Developer",
      employmentType: "PART_TIME",
      employeeStatus: "ACTIVE",
      skills: ["typescript"],
      department,
      allocatedHours: 31.5,
      remainingHours: 3.5,
      utilization: 90,
      workload: "HIGH",
    },
    {
      ...metrics,
      id: "cara",
      employeeId: "EXP-003",
      fullName: "Cara Intern",
      position: "Intern",
      employmentType: "INTERN",
      employeeStatus: "ON_LEAVE",
      skills: [],
      department,
      capacityHours: 0,
      allocatedHours: 0,
      remainingHours: 0,
      utilization: 0,
      status: "UNAVAILABLE",
      workload: "UNAVAILABLE",
      scheduleConfigured: false,
      upcomingAssignments: 0,
      assignmentCount: 0,
    },
  ]
  let staffing: Staffing[] = [
    {
      id: "staffing",
      title: "Campaign support",
      startsAt: "2030-01-08T09:00:00+08:00",
      endsAt: "2030-01-08T11:00:00+08:00",
      estimatedHours: 2,
      priority: "HIGH",
      deadline: null,
      requiredSkills: ["design"],
      status: "PENDING",
      ownerDepartmentId: "marketing",
      ownerDepartment: { id: "marketing", name: "Marketing" },
      recipientDepartmentId: department.id,
      recipientDepartment: department,
      assignment: null,
      serviceRequestId: "campaign",
      projectId: null,
      taskId: null,
    },
  ]
  let configurationSaved = false,
    assignmentSaved = false,
    staffingApproved = false,
    rejectNextAssignment = false
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "workload-test-session"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "manager",
            fullName: "Department Manager",
            email: "manager@example.com",
            role: "STAFF",
            isActive: true,
            contactNumber: null,
            createdAt: "2026-01-01T00:00:00Z",
            permissions: authorized
              ? ["dashboard:read", "workload:read", "workload:manage"]
              : ["dashboard:read"],
          },
        },
      })
    if (path === "/api/workload")
      return route.fulfill({ json: { department, employees, staffing } })
    if (path === "/api/workload/options")
      return route.fulfill({
        json: {
          departments: [{ id: "marketing", name: "Marketing" }],
          unallocatedProjects: [],
          serviceRequests: [
            {
              id: "request",
              title: "Brand refresh",
              preferredSpecialistName: "Bob Developer",
            },
          ],
          projects: [],
        },
      })
    if (path === "/api/workload/employees/alice/configuration") {
      const input = request.postDataJSON() as { skills: string[] }
      configurationSaved = true
      employees = employees.map((e) =>
        e.id === "alice" ? { ...e, skills: input.skills } : e,
      )
      return route.fulfill({ json: { saved: true } })
    }
    if (path === "/api/workload/employees/alice") {
      const start = url.searchParams.get("start")!,
        days = Number(url.searchParams.get("days"))
      return route.fulfill({
        json: {
          ...employees[0],
          workingSchedule: [{ weekday: 1, startMinute: 540, endMinute: 720 }],
          commitments: [],
          assignments: [
            {
              id: "assignment",
              title: "Brand research",
              startsAt: "2030-01-07T09:00:00+08:00",
              endsAt: "2030-01-07T12:00:00+08:00",
              estimatedHours: 3,
              priority: "NORMAL",
              deadline: "2030-01-07T17:00:00+08:00",
              requiredSkills: ["design"],
              status: "CONFIRMED",
              ownerDepartmentId: department.id,
              ownerDepartment: department,
              serviceRequestId: "request",
              serviceRequest: {
                id: "request",
                title: "Brand refresh",
                status: "PENDING",
              },
              projectId: null,
              project: null,
              taskId: null,
              task: null,
            },
          ],
          upcomingBeyondPeriod: [],
          calendar: Array.from({ length: days }, (_, index) => ({
            ...metrics,
            date: new Date(+new Date(`${start}T00:00:00Z`) + index * 86_400_000)
              .toISOString()
              .slice(0, 10),
            assignments: [],
          })),
        },
      })
    }
    if (path === "/api/workload/assignments" && request.method() === "POST") {
      const input = request.postDataJSON() as {
        employeeId: string
        serviceRequestId: string
        startsAt: string
      }
      expect(input.employeeId).toBe("alice")
      expect(input.serviceRequestId).toBe("request")
      expect(input.startsAt).toMatch(/\+08:00$/)
      if (rejectNextAssignment) {
        rejectNextAssignment = false
        return route.fulfill({
          status: 409,
          json: { error: "The block overlaps an existing assignment" },
        })
      }
      assignmentSaved = true
      return route.fulfill({ status: 201, json: { id: "new-assignment" } })
    }
    if (path === "/api/workload/staffing-requests/staffing") {
      expect(request.postDataJSON()).toEqual({
        decision: "APPROVED",
        employeeId: "alice",
      })
      staffingApproved = true
      staffing = staffing.map((s) => ({
        ...s,
        status: "APPROVED",
        assignment: {
          id: "approved",
          status: "CONFIRMED",
          employee: { fullName: "Alice Designer" },
        },
      }))
      return route.fulfill({ json: { saved: true, assignmentId: "approved" } })
    }
    return route.fulfill({
      status: 404,
      json: { error: `Unexpected API call: ${path}` },
    })
  })
  return {
    configurationSaved: () => configurationSaved,
    assignmentSaved: () => assignmentSaved,
    staffingApproved: () => staffingApproved,
    rejectNextAssignment: () => {
      rejectNextAssignment = true
    },
  }
}

for (const width of [1440, 390]) {
  test(`manager reviews, configures, assigns and approves staffing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 })
    const state = await setup(page)
    await page.goto("/workload")
    await expect(
      page.getByRole("heading", { name: "Staff Workload", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Alice Designer", exact: true }),
    ).toBeVisible()
    await page.getByLabel("Week beginning").fill("2030-01-07")
    await expect(
      page.getByRole("button", { name: "Alice Designer", exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: `../../.ci-tools/workload/staff-${width}.png`,
      fullPage: true,
    })
    await page.getByLabel("Search staff").fill("Alice")
    await expect(
      page.getByRole("button", { name: "Bob Developer", exact: true }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Clear filters" }).click()
    await page
      .getByRole("combobox", { name: "Employment type", exact: true })
      .click()
    await page.getByRole("option", { name: "Intern", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Cara Intern", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Alice Designer", exact: true }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Clear filters" }).click()
    await page.getByRole("combobox", { name: "Sort employees" }).click()
    await page.getByRole("option", { name: "Highest utilization" }).click()
    await expect(page.locator("tbody tr").first()).toContainText(
      "Bob Developer",
    )
    await page
      .getByRole("button", { name: "Alice Designer", exact: true })
      .click()
    let dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("tab", { name: "Availability calendar" }),
    ).toBeVisible()
    await expect(dialog.locator("article")).toHaveCount(7)
    await dialog.getByRole("tab", { name: /Assignments/ }).click()
    await expect(
      dialog.getByRole("heading", { name: "Brand research" }),
    ).toBeVisible()
    await dialog.getByRole("tab", { name: "Configure availability" }).click()
    await dialog
      .getByLabel("Skills / specializations (comma separated)")
      .fill("design, figma")
    await dialog
      .getByRole("button", { name: "Save schedule and skills" })
      .click()
    await expect.poll(state.configurationSaved).toBe(true)
    await expect(dialog.getByText("Skills: design, figma")).toBeVisible()
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("combobox", { name: "Period", exact: true }).click()
    await page.getByRole("option", { name: "Monthly", exact: true }).click()
    await page
      .getByRole("button", { name: "Alice Designer", exact: true })
      .click()
    dialog = page.getByRole("dialog")
    await expect(dialog.locator("article")).toHaveCount(31)
    await page.screenshot({
      path: `../../.ci-tools/workload/calendar-${width}.png`,
    })
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("button", { name: "Assign work", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog
      .getByLabel("Service request, project or task")
      .selectOption("serviceRequestId:request")
    await expect(
      dialog.getByText(/Client preference: Bob Developer/),
    ).toBeVisible()
    await expect(dialog.getByLabel("Employee", { exact: true })).toHaveValue("")
    await dialog.getByLabel("Assignment title").fill("Brand workshop")
    await dialog.getByLabel("Employee", { exact: true }).selectOption("alice")
    await dialog.getByLabel("Required skills (comma separated)").fill("design")
    await dialog
      .getByLabel("Start (Manila)", { exact: true })
      .fill("2030-01-09T09:00")
    await dialog
      .getByLabel("End (Manila)", { exact: true })
      .fill("2030-01-09T11:00")
    await dialog.getByLabel("Estimated allocated hours").fill("2")
    state.rejectNextAssignment()
    await dialog.getByRole("button", { name: "Confirm assignment" }).click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "The block overlaps an existing assignment",
    )
    expect(state.assignmentSaved()).toBe(false)
    await dialog.getByRole("button", { name: "Confirm assignment" }).click()
    await expect.poll(state.assignmentSaved).toBe(true)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.getByRole("tab", { name: /Staffing requests/ }).click()
    await page.getByLabel("Employee to approve").selectOption("alice")
    await page.getByRole("button", { name: "Approve and assign" }).click()
    await expect.poll(state.staffingApproved).toBe(true)
    await page.getByRole("combobox", { name: "Request status" }).click()
    await page.getByRole("option", { name: "Approved", exact: true }).click()
    await expect(
      page.getByText(/Approved personnel: Alice Designer/),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
  })
}
test("ordinary Staff cannot navigate directly to workload", async ({
  page,
}) => {
  await setup(page, false)
  await page.goto("/workload")
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole("link", { name: "Staff Workload", exact: true }),
  ).toHaveCount(0)
})
