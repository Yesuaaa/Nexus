import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("workspace board groups tasks and updates the existing plan", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const task = {
    id: "task-1",
    title: "Prepare assets",
    role: "Designer",
    status: "NOT_STARTED",
    employeeId: null,
    dueDate: null,
  }
  const workspace = {
    id: "group:board",
    name: "Board workspace",
    client: { id: "client", fullName: "Client" },
    status: "IN_PROGRESS",
    structure: "MULTI_WORKSTREAM",
    canManage: true,
    activity: [],
    workstreams: [
      {
        id: "project-1",
        name: "Project",
        serviceName: "Design",
        status: "IN_PROGRESS",
        updatedAt: "2026-01-01T00:00:00Z",
        milestones: [],
        staff: [],
        plan: { phases: [{ id: "phase-1", title: "Planning", tasks: [task] }] },
      },
    ],
  }
  let gets = 0
  await page.route("**/api/project-workspace/**", async (route) => {
    if (route.request().method() === "POST") {
      workspace.workstreams[0]!.plan.phases[0]!.tasks.push({
        ...task,
        id: "task-new",
        title: route.request().postDataJSON().title,
        status: "NOT_STARTED",
      })
    } else if (route.request().method() === "PATCH") {
      task.status = route.request().postDataJSON().status
    } else gets++
    await route.fulfill({ json: workspace })
  })
  await page.goto("/project-workspace/group%3Aboard")
  await page.getByRole("link", { name: "Work", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Edit project plan" }),
  ).toBeVisible()
  const initialGets = gets
  await page.getByRole("tab", { name: "Board", exact: true }).click()
  await page.getByRole("button", { name: "Add task", exact: true }).click()
  await page.getByLabel("Task name").fill("New board task")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add task", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "View New board task" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "View Prepare assets" })
    .dragTo(page.getByRole("region", { name: "In progress" }))
  await expect(page.getByRole("region", { name: "In progress" })).toContainText(
    "Prepare assets",
  )
  await page
    .getByRole("button", { name: "View Prepare assets" })
    .dragTo(page.getByRole("region", { name: "Not started" }))
  await expect(page.getByRole("region", { name: "Not started" })).toContainText(
    "Prepare assets",
  )
  await expect(page.getByRole("region", { name: "Not started" })).toContainText(
    "Not started",
  )
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const sections = await page
      .getByRole("region", { name: /^(Not started|In progress|Complete)$/ })
      .all()
    expect(sections).toHaveLength(3)
    const boxes = await Promise.all(
      sections.map((section) => section.boundingBox()),
    )
    expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(1)
    expect(boxes[0]!.width).toBeGreaterThanOrEqual(255)
    expect(Math.abs(boxes[0]!.width - boxes[2]!.width)).toBeLessThan(1)
  }
  await page
    .getByRole("button", { name: "View Prepare assets" })
    .getByText("Planning", { exact: true })
    .click()
  await expect(page.getByText("Task details", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  const cardBody = page.getByRole("button", { name: "View Prepare assets" })
  const box = await cardBody.boundingBox()
  if (!box) throw new Error("Task card is not visible")
  await cardBody.click({ position: { x: box.width - 5, y: box.height - 5 } })
  await expect(page.getByText("Task details", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await page
    .getByRole("button", { name: "Change status for Prepare assets" })
    .click()
  await page.getByRole("menuitem", { name: "In progress" }).click()
  await expect(page.getByRole("region", { name: "In progress" })).toContainText(
    "Prepare assets",
  )
  expect(gets).toBe(initialGets)
  await page.getByRole("tab", { name: "List", exact: true }).click()
  await expect(page.getByText("In progress", { exact: true })).toBeVisible()
})

test("board recovers from errors and scopes grouped tasks with terminal controls", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const makeStream = (id: string, status: string, title: string) => ({
    id,
    name: id,
    serviceName: id,
    status,
    updatedAt: "2026-01-01T00:00:00Z",
    milestones: [],
    staff: [],
    plan: {
      phases: [
        {
          id: `phase-${id}`,
          title: "Planning",
          tasks: [
            {
              id: `task-${id}`,
              title,
              role: "Designer",
              status: "NOT_STARTED",
              employeeId: null,
              dueDate: null,
            },
          ],
        },
      ],
    },
  })
  const workspace = {
    id: "group:board",
    name: "Board workspace",
    client: { id: "client", fullName: "Client" },
    status: "IN_PROGRESS",
    structure: "MULTI_WORKSTREAM",
    canManage: true,
    activity: [],
    workstreams: [
      makeStream("active", "IN_PROGRESS", "Active task"),
      makeStream("completed", "COMPLETED", "Completed project task"),
      makeStream("cancelled", "CANCELLED", "Cancelled project task"),
    ],
  }
  const writes: string[] = []
  let fail = true
  await page.route("**/api/project-workspace/**", async (route) => {
    if (route.request().method() === "PATCH") {
      writes.push(decodeURIComponent(new URL(route.request().url()).pathname))
      if (fail)
        return route.fulfill({ status: 500, json: { error: "Save failed" } })
      workspace.workstreams[0]!.plan.phases[0]!.tasks[0]!.status = route
        .request()
        .postDataJSON().status
    }
    await route.fulfill({ json: workspace })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/project-workspace/group%3Aboard")
  await page.getByRole("link", { name: "Work", exact: true }).click()
  await page.getByRole("tab", { name: "Board", exact: true }).click()
  await expect(page.getByRole("region", { name: "Not started" })).toContainText(
    "Not started",
  )
  await expect(
    page.getByRole("button", {
      name: "Change status for Completed project task",
    }),
  ).toBeDisabled()
  await expect(
    page.getByRole("button", {
      name: "Change status for Cancelled project task",
    }),
  ).toBeDisabled()
  const card = page.getByRole("button", { name: "View Active task" })
  await expect(card.getByText("Planning", { exact: true })).toBeVisible()
  await expect(card.getByText("active", { exact: true })).toBeVisible()
  await card.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByText("Task details", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await card.focus()
  await page.keyboard.press("Space")
  await expect(page.getByText("Task details", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  const select = page.getByRole("button", {
    name: "Change status for Active task",
  })
  await select.focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByText("Task details", { exact: true }),
  ).not.toBeVisible()
  await page.getByRole("menuitem", { name: "In progress" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "Save failed" }),
  ).toBeVisible()
  await expect(page.getByRole("region", { name: "Not started" })).toContainText(
    "Active task",
  )
  fail = false
  await select.click()
  await page.getByRole("menuitem", { name: "In progress" }).click()
  await expect(page.getByRole("region", { name: "In progress" })).toContainText(
    "Active task",
  )
  expect(writes).toEqual([
    "/api/project-workspace/group:board/projects/active/tasks/task-active",
    "/api/project-workspace/group:board/projects/active/tasks/task-active",
  ])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole("tab", { name: "List", exact: true }).click()
  await expect(page.getByText("Active task", { exact: true })).toBeVisible()
})

test("custom board columns persist and return tasks on deletion", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const task = {
    id: "task-1",
    title: "Review assets",
    role: "Designer",
    status: "IN_PROGRESS",
    employeeId: null,
    dueDate: null,
  }
  const workspace = {
    id: "group:board",
    name: "Board workspace",
    client: { id: "client", fullName: "Client" },
    status: "IN_PROGRESS",
    structure: "MULTI_WORKSTREAM",
    canManage: true,
    activity: [],
    kanbanColumns: [] as { id: string; name: string }[],
    kanbanAssignments: [] as {
      projectId: string
      taskId: string
      columnId: string
    }[],
    workstreams: [
      {
        id: "project-1",
        name: "Project",
        serviceName: "Design",
        status: "IN_PROGRESS",
        updatedAt: "2026-01-01T00:00:00Z",
        milestones: [],
        staff: [],
        plan: { phases: [{ id: "phase-1", title: "Planning", tasks: [task] }] },
      },
    ],
  }
  await page.route("**/api/project-workspace/**", async (route) => {
    const method = route.request().method()
    const url = route.request().url()
    if (url.includes("/columns")) {
      if (method === "POST")
        workspace.kanbanColumns.push({
          id: "column-1",
          name: route.request().postDataJSON().name,
        })
      if (method === "PATCH")
        workspace.kanbanColumns[0]!.name = route.request().postDataJSON().name
      if (method === "DELETE") {
        workspace.kanbanColumns = []
        workspace.kanbanAssignments = []
      }
    } else if (method === "PATCH") {
      const body = route.request().postDataJSON()
      task.status = body.status
      workspace.kanbanAssignments = body.columnId
        ? [{ projectId: "project-1", taskId: task.id, columnId: body.columnId }]
        : []
    }
    await route.fulfill({ json: workspace })
  })
  await page.goto("/project-workspace/group%3Aboard")
  await page.getByRole("link", { name: "Work", exact: true }).click()
  await page.getByRole("tab", { name: "Board", exact: true }).click()
  await page.getByRole("button", { name: "Add column" }).click()
  await expect(page.getByRole("dialog", { name: "Add column" })).toBeVisible()
  await page.getByRole("combobox", { name: "Placement" }).click()
  await page.getByRole("option", { name: "After In Progress" }).click()
  await page.getByLabel("Column name").fill("Review")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add column" })
    .click()
  await expect(page.getByRole("region", { name: "Review" })).toBeVisible()
  const board = page.getByRole("region", { name: "Task board" })
  const columns = board.locator("section")
  const columnWidths = await columns.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  )
  expect(columnWidths).toHaveLength(4)
  expect(Math.max(...columnWidths) - Math.min(...columnWidths)).toBeLessThan(1)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await board.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page
    .getByRole("button", { name: "Change status for Review assets" })
    .click()
  await page.getByRole("menuitem", { name: "Review", exact: true }).click()
  await expect(page.getByRole("region", { name: "Review" })).toContainText(
    "Review assets",
  )
  expect(task.status).toBe("IN_PROGRESS")
  await page.reload()
  await page.getByRole("link", { name: "Work", exact: true }).click()
  await page.getByRole("tab", { name: "Board", exact: true }).click()
  await expect(page.getByRole("region", { name: "Review" })).toContainText(
    "Review assets",
  )
  await page.getByRole("button", { name: "Manage Review" }).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  await page.getByLabel("Column name").fill("Reviewing")
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click()
  await page.getByRole("button", { name: "Manage Reviewing" }).click()
  await page.getByRole("menuitem", { name: "Delete column" }).click()
  await page.getByRole("button", { name: "Delete column" }).click()
  await expect(page.getByRole("region", { name: "In progress" })).toContainText(
    "Review assets",
  )
})

test("board filters use real task metadata and support custom-column drops", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const tasks = [
    {
      id: "task-one",
      title: "Prepare the product photography shot list",
      role: "Photographer",
      status: "NOT_STARTED",
      employeeId: "person-a",
      dueDate: "2026-11-29",
    },
    {
      id: "task-two",
      title:
        "Retouch campaign images with an exceptionally long and detailed title that must wrap cleanly",
      role: "Designer",
      status: "IN_PROGRESS",
      employeeId: "person-b",
      dueDate: null,
    },
    {
      id: "task-three",
      title: "Review client brief",
      role: "Designer",
      status: "DONE",
      employeeId: null,
      dueDate: null,
    },
  ]
  const workspace = {
    id: "group:board",
    name: "Board workspace",
    client: { id: "client", fullName: "Client" },
    status: "IN_PROGRESS",
    structure: "MULTI_WORKSTREAM",
    canManage: true,
    activity: [],
    kanbanColumns: [{ id: "column-review", name: "Review" }],
    kanbanAssignments: [] as {
      projectId: string
      taskId: string
      columnId: string
    }[],
    workstreams: [
      {
        id: "project-1",
        name: "Project",
        serviceName: "Photography",
        status: "IN_PROGRESS",
        updatedAt: "2026-01-01T00:00:00Z",
        milestones: [],
        canAssign: true,
        staff: [
          {
            id: "person-a",
            fullName: "Alex Morgan",
            position: "Photographer",
            profileSpecialties: [],
          },
          {
            id: "person-b",
            fullName: "Jamie Lee",
            position: "Designer",
            profileSpecialties: [],
          },
        ],
        plan: {
          phases: [
            { id: "phase-one", title: "Planning", tasks: [tasks[0]] },
            { id: "phase-two", title: "Production", tasks: tasks.slice(1) },
          ],
        },
      },
    ],
  }
  const writes: { status: string; columnId: string | null }[] = []
  await page.route("**/api/project-workspace/**", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as {
        status: string
        columnId: string | null
      }
      writes.push(body)
      tasks[0]!.status = body.status
      workspace.kanbanAssignments = body.columnId
        ? [
            {
              projectId: "project-1",
              taskId: tasks[0]!.id,
              columnId: body.columnId,
            },
          ]
        : []
    }
    await route.fulfill({ json: workspace })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/project-workspace/group%3Aboard")
  await page.getByRole("link", { name: "Work", exact: true }).click()
  await page.getByRole("tab", { name: "Board", exact: true }).click()
  await expect(
    page.getByRole("button", {
      name: "View Prepare the product photography shot list",
    }),
  ).toBeVisible()
  const boardBounds = await page
    .getByRole("region", { name: "Task board" })
    .boundingBox()
  const completeBounds = await page
    .getByRole("region", { name: "Complete" })
    .boundingBox()
  expect(completeBounds!.x + completeBounds!.width).toBeLessThanOrEqual(
    boardBounds!.x + boardBounds!.width + 1,
  )
  await page.screenshot({
    path: testInfo.outputPath("kanban-populated.png"),
    fullPage: true,
  })
  await page.getByLabel("Search tasks").fill("shot list")
  await expect(page.getByRole("button", { name: /View Retouch/ })).toHaveCount(
    0,
  )
  await page.getByLabel("Search tasks").fill("")
  await page.getByLabel("Filter by phase").click()
  await page.getByRole("option", { name: "Production · Photography" }).click()
  await expect(page.getByRole("button", { name: /View Prepare/ })).toHaveCount(
    0,
  )
  await page.getByLabel("Filter by phase").click()
  await page.getByRole("option", { name: "All phases" }).click()
  await page.getByLabel("Filter by assignee").click()
  await page.getByRole("option", { name: "Jamie Lee" }).click()
  await expect(page.getByRole("button", { name: /View Prepare/ })).toHaveCount(
    0,
  )
  await expect(page.getByRole("button", { name: /View Retouch/ })).toBeVisible()
  await page.getByLabel("Filter by assignee").click()
  await page.getByRole("option", { name: "All assignees" }).click()
  await page
    .getByRole("button", {
      name: "View Prepare the product photography shot list",
    })
    .dragTo(page.getByRole("region", { name: "Review" }))
  await expect(page.getByRole("region", { name: "Review" })).toContainText(
    "Prepare the product photography shot list",
  )
  expect(writes.at(-1)).toMatchObject({
    status: "IN_PROGRESS",
    columnId: "column-review",
  })
  await page
    .getByRole("button", {
      name: "View Prepare the product photography shot list",
    })
    .dragTo(page.getByRole("region", { name: "In progress" }))
  expect(writes.at(-1)).toMatchObject({ status: "IN_PROGRESS", columnId: null })
  await page.getByLabel("Search tasks").fill("no matching task")
  await expect(page.getByText("No tasks match these filters.")).toBeVisible()
  workspace.workstreams[0]!.plan.phases.forEach((phase) => {
    phase.tasks = []
  })
  await page.reload()
  await page.getByRole("link", { name: "Work", exact: true }).click()
  await page.getByRole("tab", { name: "Board", exact: true }).click()
  await expect(page.getByRole("region", { name: "Not started" })).toContainText(
    "No tasks",
  )
  await page.screenshot({
    path: testInfo.outputPath("kanban-empty.png"),
    fullPage: true,
  })
})
