import { expect, test } from "@playwright/test"
import type { ProjectWorkspaceDetail } from "../src/features/project-workspace/api/project-workspace-api"
import type { AdministrativeProject } from "../src/features/projects/api/administrative-projects-api"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

const now = "2026-11-15T12:00:00.000Z"

function noteRevision(
  id: string,
  revision: number,
  status: "SUBMITTED" | "ESCALATED" | "APPROVED" | "REVISION_REQUIRED",
  authorId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    revision,
    content: `Note content ${id}`,
    authorId,
    status,
    submittedAt: now,
    reviewedAt: status === "APPROVED" ? now : null,
    feedback: null,
    escalatedAt: status === "ESCALATED" ? now : null,
    clientVisible: status === "APPROVED",
    publishedAt: status === "APPROVED" ? now : null,
    publishedById: status === "APPROVED" ? "reviewer" : null,
    publishedBy:
      status === "APPROVED" ? { id: "reviewer", fullName: "Reviewer" } : null,
    supersededAt: null,
    supersededByRevisionId: null,
    supersededByRevision: null,
    unpublishedAt: null,
    unpublishedById: null,
    unpublishedBy: null,
    author: {
      id: authorId,
      fullName: authorId === "actor" ? "Test Person" : "Designer",
    },
    reviewedBy:
      status === "APPROVED" ? { id: "reviewer", fullName: "Reviewer" } : null,
    ...overrides,
  }
}

function submission(
  id: string,
  version: number,
  status:
    "IN_REVIEW" | "ESCALATED" | "REJECTED" | "APPROVED" | "SENT_TO_CLIENT",
  submittedById: string,
) {
  return {
    id,
    version,
    note: null,
    status,
    submittedAt: now,
    submittedById,
    submittedBy: {
      id: submittedById,
      fullName: submittedById === "actor" ? "Test Person" : "Designer",
    },
    reviewedAt: null,
    feedback: null,
    escalatedAt: status === "ESCALATED" ? now : null,
    reviewedBy: null,
    workflowFile: {
      id: `${id}-file`,
      name: `${id}.pdf`,
      mimeType: "application/pdf",
      size: 1024,
      createdAt: now,
    },
  }
}

function workspace(
  flags: { teamLead?: boolean; departmentHead?: boolean } = {},
) {
  const sent = submission("sent", 1, "SENT_TO_CLIENT", "designer")
  const inReview = submission("review", 1, "IN_REVIEW", "designer")
  const rejected = submission("rejected", 1, "REJECTED", "actor")
  const escalated = submission("escalated", 1, "ESCALATED", "designer")
  const milestones = [
    {
      id: "d1",
      title: "Client-ready brand files",
      deliveryStatus: "SENT_TO_CLIENT",
      workflowFileId: sent.workflowFile.id,
      submissions: [sent],
    },
    {
      id: "d2",
      title: "Landing page draft",
      deliveryStatus: "IN_REVIEW",
      workflowFileId: inReview.workflowFile.id,
      submissions: [inReview],
    },
    {
      id: "d3",
      title: "Campaign concepts",
      deliveryStatus: "REJECTED",
      workflowFileId: rejected.workflowFile.id,
      submissions: [rejected],
    },
    {
      id: "d4",
      title: "Final asset package",
      deliveryStatus: "IN_REVIEW",
      workflowFileId: escalated.workflowFile.id,
      submissions: [escalated],
    },
  ].map((item) => ({
    description: null,
    expectedFileType: "PDF",
    rejectionReason: null,
    reviewedAt: null,
    updatedAt: now,
    completedAt: null,
    sentToClientAt: item.deliveryStatus === "SENT_TO_CLIENT" ? now : null,
    workflowFile: null,
    ...item,
  }))

  const detail = {
    id: "overview-project",
    rowId: "group:overview-project",
    kind: "group",
    name: "Overview project",
    structure: "MULTI_WORKSTREAM",
    status: "IN_PROGRESS",
    client: { id: "client-1", fullName: "Northstar Studio" },
    updatedAt: now,
    activityCount: 0,
    canCreate: false,
    canManage: true,
    canRename: false,
    workstreams: [
      {
        id: "stream-1",
        requestId: "request-1",
        name: "Brand refresh",
        description: "A clear, accessible identity for the next launch.",
        serviceName: "Brand Design",
        referenceNumber: "BR-100",
        workflowState: "ACTIVATED",
        status: "IN_PROGRESS",
        startDate: "2026-10-01T00:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        templateKey: "brand-design",
        taskCount: 3,
        completedTaskCount: 2,
        plan: {
          phases: [
            {
              id: "phase-1",
              title: "Discovery",
              tasks: [
                {
                  id: "task-1",
                  title: "Interview stakeholders",
                  role: "Designer",
                  status: "DONE",
                  employeeId: "employee-1",
                },
                {
                  id: "task-2",
                  title: "Review references",
                  role: "Designer",
                  status: "DONE",
                  employeeId: "employee-1",
                },
                {
                  id: "task-3",
                  title: "Draft direction",
                  role: "Designer",
                  status: "IN_PROGRESS",
                  employeeId: "employee-1",
                },
              ],
            },
          ],
        },
        milestones,
        notes: [
          {
            id: "note-actor",
            createdAt: now,
            updatedAt: now,
            createdBy: { id: "actor", fullName: "Test Person" },
            revisions: [
              noteRevision("note-actor-old", 1, "SUBMITTED", "actor", {
                supersededAt: now,
                supersededByRevisionId: "note-actor-current",
              }),
              noteRevision(
                "note-actor-current",
                2,
                "REVISION_REQUIRED",
                "actor",
              ),
            ],
          },
          {
            id: "note-team-lead",
            createdAt: now,
            updatedAt: now,
            createdBy: { id: "designer", fullName: "Designer" },
            revisions: [
              noteRevision(
                "note-team-lead-current",
                1,
                "SUBMITTED",
                "designer",
              ),
            ],
          },
          {
            id: "note-head",
            createdAt: now,
            updatedAt: now,
            createdBy: { id: "designer", fullName: "Designer" },
            revisions: [
              noteRevision("note-head-current", 1, "ESCALATED", "designer"),
            ],
          },
          {
            id: "note-published",
            createdAt: now,
            updatedAt: now,
            createdBy: { id: "designer", fullName: "Designer" },
            revisions: [
              noteRevision("note-published-old", 1, "APPROVED", "designer", {
                supersededAt: now,
                supersededByRevisionId: "note-published-current",
              }),
              noteRevision("note-published-current", 2, "APPROVED", "designer"),
            ],
          },
        ],
        changeRequests: [
          {
            id: "request-pending",
            kind: "CHANGE",
            details: "Add a second layout option.",
            status: "PENDING",
            responseNote: null,
            createdAt: now,
            reviewedAt: null,
            requestedBy: { fullName: "Northstar Studio" },
          },
          {
            id: "request-accepted",
            kind: "CANCELLATION",
            details: "Keep the current booking.",
            status: "ACCEPTED",
            responseNote: "Accepted",
            createdAt: now,
            reviewedAt: now,
            requestedBy: { fullName: "Northstar Studio" },
          },
        ],
        isTeamLead: flags.teamLead ?? false,
        hasTeamLead: true,
        isDepartmentHead: flags.departmentHead ?? false,
        canReviewDeliverables: flags.teamLead ?? flags.departmentHead ?? false,
        canReviewRequests: flags.departmentHead ?? false,
        canUploadDeliverables: true,
        staff: [
          {
            id: "employee-1",
            fullName: "Assigned Designer",
            position: "Designer",
            status: "ACTIVE",
            profileSpecialties: [],
            approvedAt: now,
            isTeamLead: Boolean(flags.teamLead),
          },
        ],
        canAssign: Boolean(flags.departmentHead),
      },
    ],
    activity: [],
  }
  return detail as unknown as ProjectWorkspaceDetail
}

function addOwnSubmittedNote(detail: ProjectWorkspaceDetail, noteId: string) {
  const stream = detail.workstreams[0]
  if (!stream) throw new Error("Workspace fixture needs a workstream")
  const revisionId = `${noteId}-revision`
  stream.notes = [
    ...(stream.notes ?? []),
    {
      id: noteId,
      createdAt: now,
      updatedAt: now,
      createdBy: { id: "actor", fullName: "Test Person" },
      revisions: [noteRevision(revisionId, 1, "SUBMITTED", "actor")],
    },
  ]
  return revisionId
}

async function mockStaffWorkspace(
  page: Parameters<typeof restoreSession>[0],
  detail: ProjectWorkspaceDetail,
  options: Parameters<typeof restoreSession>[2] = {},
) {
  await restoreSession(page, "STAFF", {
    account: { id: "actor", departmentId: "design", ...options.account },
  })
  await page.route("**/api/project-workspace/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    if (path.endsWith("/group:overview-project"))
      return route.fulfill({ json: detail })
    return route.fallback()
  })
  await page.goto("/project-workspace/group%3Aoverview-project")
}

test("Staff overview summarizes current records and links to existing sections", async ({
  page,
}) => {
  await mockStaffWorkspace(page, workspace())

  await expect(
    page.getByRole("heading", { name: "Overview project" }),
  ).toBeVisible()
  const projectHeader = page
    .getByRole("heading", { name: "Overview project" })
    .locator("xpath=ancestor::header[1]")
  const chatLink = projectHeader.getByRole("link", {
    name: "Chat with client · Brand refresh",
  })
  await expect(chatLink).toHaveAttribute("href", "/messages?project=stream-1")
  await expect(chatLink).toHaveText("Chat with client")
  await expect(chatLink).toHaveAttribute(
    "aria-label",
    "Chat with client · Brand refresh",
  )
  await expect(chatLink.locator("svg")).toHaveAttribute("aria-hidden", "true")
  await expect(
    projectHeader.getByRole("button", { name: "Manage project status" }),
  ).toBeVisible()
  const summary = page.getByRole("region", { name: "Project overview summary" })
  const projectDetails = page.locator('dl[aria-label="Project details"]')
  const headerBox = await projectHeader.boundingBox()
  const detailsBox = await projectDetails.boundingBox()
  const summaryBox = await summary.boundingBox()
  expect(
    detailsBox!.y - (headerBox!.y + headerBox!.height),
  ).toBeGreaterThanOrEqual(11)
  expect(
    detailsBox!.y - (headerBox!.y + headerBox!.height),
  ).toBeLessThanOrEqual(13)
  expect(
    summaryBox!.y - (detailsBox!.y + detailsBox!.height),
  ).toBeGreaterThanOrEqual(15)
  const summaryCards = await summary.getByRole("article").all()
  const summaryCardBoxes = await Promise.all(
    summaryCards.map((card) => card.boundingBox()),
  )
  expect(summaryCardBoxes).toHaveLength(4)
  for (let index = 0; index < summaryCardBoxes.length - 1; index += 1) {
    const current = summaryCardBoxes[index]!
    const next = summaryCardBoxes[index + 1]!
    expect(next.x - (current.x + current.width)).toBeGreaterThanOrEqual(8)
    expect(next.x - (current.x + current.width)).toBeLessThanOrEqual(12)
    expect(Math.abs(next.height - current.height)).toBeLessThanOrEqual(1)
  }
  await expect(
    summary.getByRole("link", { name: "View task progress" }),
  ).toContainText("67%")
  await expect(
    summary.getByRole("link", { name: "View task progress" }),
  ).toContainText("2 of 3 tasks complete")
  await expect(
    summary.getByRole("link", { name: "View deliverables" }),
  ).toContainText("1 / 4 sent")
  await expect(
    summary.getByRole("link", { name: "View deliverables" }),
  ).toContainText("2 internal reviews pending")
  await expect(
    summary.getByRole("link", { name: "View deliverables" }),
  ).toContainText("1 needs changes")
  await expect(
    summary.getByRole("link", { name: "View project notes" }),
  ).toContainText("4")
  await expect(
    summary.getByRole("link", { name: "View project notes" }),
  ).toContainText("2 awaiting review")
  await expect(
    summary.getByRole("link", { name: "View project notes" }),
  ).toContainText("1 published")
  await expect(
    summary.getByRole("link", { name: "View client requests" }),
  ).toContainText("2")
  await expect(
    summary.getByRole("link", { name: "View client requests" }),
  ).toContainText("1 pending")
  for (const [name, section] of [
    ["View task progress", "work"],
    ["View deliverables", "deliverables"],
    ["View project notes", "notes"],
    ["View client requests", "requests"],
  ]) {
    await expect(summary.getByRole("link", { name })).toHaveAttribute(
      "href",
      "/project-workspace/group%3Aoverview-project?tab=" + section,
    )
  }
  await expect(
    page.getByRole("heading", { name: "Requires Attention" }),
  ).toBeVisible()
  await expect(
    page.getByText("Your task assignment can't be matched in this overview."),
  ).toBeVisible()
  await expect(
    page.getByText("Your note needs revision", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Your deliverable needs changes", { exact: true }),
  ).toBeVisible()
  const attention = page.getByRole("region", { name: "Requires Attention" })
  const attentionBox = await attention.boundingBox()
  const brief = page
    .getByRole("heading", { name: "Project brief" })
    .locator("xpath=ancestor::section[1]")
  const briefBox = await brief.boundingBox()
  expect(
    attentionBox!.y - (summaryBox!.y + summaryBox!.height),
  ).toBeGreaterThanOrEqual(18)
  expect(
    briefBox!.y - (attentionBox!.y + attentionBox!.height),
  ).toBeGreaterThanOrEqual(18)
  await expect(
    page.getByRole("heading", { name: "Project brief" }),
  ).toBeVisible()
  await expect(
    page.getByText("Assigned Designer", { exact: true }),
  ).toBeVisible()
  const notesLink = summary.getByRole("link", { name: "View project notes" })
  let notesLinkFocused = false
  for (let attempt = 0; attempt < 40 && !notesLinkFocused; attempt += 1) {
    await page.keyboard.press("Tab")
    notesLinkFocused = await notesLink.evaluate(
      (element) => element === document.activeElement,
    )
  }
  expect(notesLinkFocused).toBe(true)
  expect(
    await notesLink.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true)
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  for (const section of [
    "Overview",
    "Work",
    "Deliverables",
    "Notes",
    "Requests",
    "Team",
    "Activity",
  ])
    await expect(
      sidebar.getByRole("link", { name: section, exact: true }),
    ).toBeVisible()

  await summary.getByRole("link", { name: "View project notes" }).click()
  await expect(page).toHaveURL(
    "/project-workspace/group%3Aoverview-project?tab=notes",
  )
})

test("overview summary and navigation fit a narrow mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockStaffWorkspace(page, workspace())

  const summary = page.getByRole("region", { name: "Project overview summary" })
  for (const name of [
    "View task progress",
    "View deliverables",
    "View project notes",
    "View client requests",
  ]) {
    await expect(summary.getByRole("link", { name })).toBeVisible()
  }
  const projectHeader = page
    .getByRole("heading", { name: "Overview project" })
    .locator("xpath=ancestor::header[1]")
  await expect(
    projectHeader.getByRole("link", { name: /Chat with client/ }),
  ).toBeVisible()
  await expect(
    projectHeader.getByRole("button", { name: "Manage project status" }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)

  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(sidebar).toHaveAttribute("data-drawer-open", "true")
  await expect(
    sidebar.getByRole("link", { name: "Deliverables", exact: true }),
  ).toBeVisible()
})

test("whitespace-only project scope uses the concise empty brief message", async ({
  page,
}) => {
  const detail = workspace()
  detail.workstreams[0].description = " \n   "
  await mockStaffWorkspace(page, detail)

  await expect(
    page.getByRole("heading", { name: "Project brief" }),
  ).toBeVisible()
  await expect(
    page.getByText("No project goals have been provided.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("A clear, accessible identity for the next launch."),
  ).toHaveCount(0)
})

test("loaded empty notes and requests show confirmed zero counts and remain navigable", async ({
  page,
}) => {
  const detail = workspace()
  detail.workstreams[0].notes = []
  detail.workstreams[0].changeRequests = []
  detail.workstreams[0].milestones = []
  await mockStaffWorkspace(page, detail)

  const summary = page.getByRole("region", { name: "Project overview summary" })
  const notesCard = summary.getByRole("link", { name: "View project notes" })
  const requestsCard = summary.getByRole("link", {
    name: "View client requests",
  })
  await expect(notesCard).toContainText("0 unique notes")
  await expect(notesCard).toContainText("0 awaiting review")
  await expect(notesCard).not.toContainText("Data unavailable")
  await expect(requestsCard).toContainText("0 requests")
  await expect(requestsCard).toContainText("0 pending")
  await expect(requestsCard).not.toContainText("Data unavailable")
})

test("project note, revision, and review drafts accept input safely", async ({
  page,
}) => {
  await mockStaffWorkspace(page, workspace({ teamLead: true }))
  await page.getByRole("link", { name: "Notes", exact: true }).click()

  const noteDraft = page.getByLabel("Add a project note")
  await noteDraft.fill("A new internal note draft")
  await expect(noteDraft).toHaveValue("A new internal note draft")

  const revisionDraft = page.getByPlaceholder(
    "Update the note based on review feedback.",
  )
  await revisionDraft.fill("A revised project note")
  await expect(revisionDraft).toHaveValue("A revised project note")

  const reviewFeedback = page.getByPlaceholder(
    "Add feedback when requesting changes or rejecting.",
  )
  await reviewFeedback.fill("Please adjust the opening section.")
  await expect(reviewFeedback).toHaveValue("Please adjust the opening section.")

  const publicationCheckbox = page.getByRole("checkbox", {
    name: "Share with the client after approval",
  })
  await publicationCheckbox.check()
  await expect(publicationCheckbox).toBeChecked()
})

test("assigned Team Leads can review their own submitted notes", async ({
  page,
}) => {
  const detail = workspace({ teamLead: true })
  const revisionId = addOwnSubmittedNote(detail, "note-own-team-lead")
  await mockStaffWorkspace(page, detail)
  await page.getByRole("link", { name: "Notes", exact: true }).click()

  const ownRevision = page
    .getByText(`Note content ${revisionId}`, { exact: true })
    .locator("xpath=ancestor::li[1]")
  await expect(
    ownRevision.getByRole("button", { name: "Approve" }),
  ).toBeVisible()
  await expect(
    ownRevision.getByRole("button", { name: "Reject" }),
  ).toBeVisible()
  await expect(
    ownRevision.getByRole("button", { name: "Request changes" }),
  ).toHaveCount(0)
})

test("Department Heads can review their own submitted notes", async ({
  page,
}) => {
  const detail = workspace({ departmentHead: true })
  const revisionId = addOwnSubmittedNote(detail, "note-own-department-head")
  await mockStaffWorkspace(page, detail, {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await page.getByRole("link", { name: "Notes", exact: true }).click()

  const ownRevision = page
    .getByText(`Note content ${revisionId}`, { exact: true })
    .locator("xpath=ancestor::li[1]")
  await expect(
    ownRevision.getByRole("button", { name: "Approve" }),
  ).toBeVisible()
  await expect(
    ownRevision.getByRole("button", { name: "Reject" }),
  ).toBeVisible()
  await expect(
    ownRevision.getByRole("button", { name: "Request changes" }),
  ).toHaveCount(0)
})

test("empty attention state stays compact", async ({ page }) => {
  const detail = workspace()
  const stream = detail.workstreams[0]
  stream.taskCount = 0
  stream.completedTaskCount = 0
  stream.plan = { phases: [] }
  stream.milestones = []
  stream.notes = []
  stream.changeRequests = []
  await mockStaffWorkspace(page, detail)

  const attention = page.getByRole("region", { name: "Requires Attention" })
  await expect(
    attention.getByRole("heading", { name: "Nothing needs your attention" }),
  ).toBeVisible()
  const box = await attention.boundingBox()
  expect(box?.height).toBeLessThan(150)
})

test("projects without tasks do not display a completed percentage", async ({
  page,
}) => {
  const detail = workspace()
  detail.workstreams[0].taskCount = 0
  detail.workstreams[0].completedTaskCount = 0
  detail.workstreams[0].plan = {
    phases: [{ id: "empty-phase", title: "No work", tasks: [] }],
  }
  await mockStaffWorkspace(page, detail)

  const taskCard = page
    .getByRole("region", { name: "Project overview summary" })
    .getByRole("link", { name: "View task progress" })
  await expect(taskCard).toContainText("No tasks")
  await expect(taskCard.getByRole("progressbar")).toHaveCount(0)
})

test("Team Lead sees only its pending review queue in the shared overview", async ({
  page,
}) => {
  await mockStaffWorkspace(page, workspace({ teamLead: true }))

  const attention = page.getByRole("region", { name: "Requires Attention" })
  await expect(
    attention.getByText("1 note awaiting Team Lead review"),
  ).toBeVisible()
  await expect(
    attention.getByText("1 deliverable awaiting Team Lead review"),
  ).toBeVisible()
  await expect(
    attention.getByRole("button", { name: /approve|reject|escalate/i }),
  ).toHaveCount(0)
})

test("Department Head sees escalations and authorized request decisions", async ({
  page,
}) => {
  await mockStaffWorkspace(page, workspace({ departmentHead: true }), {
    account: { headOf: { id: "design", name: "Design" } },
  })

  const attention = page.getByRole("region", { name: "Requires Attention" })
  await expect(attention.getByText("1 escalated note")).toBeVisible()
  await expect(attention.getByText("1 escalated deliverable")).toBeVisible()
  await expect(
    attention.getByText("1 client request needs your decision"),
  ).toBeVisible()
})

test("Superadmin gets unavailable states for missing data and no overview mutations", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const writes: string[] = []
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      request.method() !== "GET"
    )
      writes.push(request.url())
  })
  const adminWorkspace = workspace()
  const adminWorkstreams = adminWorkspace.workstreams.map((stream) => {
    const adminStream = { ...stream }
    delete adminStream.notes
    delete adminStream.changeRequests
    return adminStream
  })
  const adminProject = {
    ...adminWorkspace,
    workstreams: adminWorkstreams,
    department: { id: "design", name: "Design" },
    workspaceGroup: {
      id: "group-1",
      name: "Northstar Workspace",
      structure: "MULTI_WORKSTREAM",
    },
    capabilities: {
      read: true,
      manage: false,
      rename: true,
      approve: false,
      release: false,
      participate: false,
      downloadFiles: false,
    },
  } as unknown as AdministrativeProject
  await page.route("**/api/administrative-projects/**", (route) =>
    route.fulfill({ json: { project: adminProject } }),
  )
  await page.goto("/module/project-management?project=overview-project")

  await expect(
    page.getByRole("heading", { name: "Project Oversight" }),
  ).toBeVisible()
  const adminHeader = page
    .getByRole("heading", { name: "Overview project" })
    .locator("xpath=ancestor::header[1]")
  const adminHeaderBox = await adminHeader.boundingBox()
  const adminDetailsBox = await page
    .locator('dl[aria-label="Project details"]')
    .boundingBox()
  expect(
    adminDetailsBox!.y - (adminHeaderBox!.y + adminHeaderBox!.height),
  ).toBeGreaterThanOrEqual(11)
  expect(
    adminDetailsBox!.y - (adminHeaderBox!.y + adminHeaderBox!.height),
  ).toBeLessThanOrEqual(13)
  const summary = page.getByRole("region", { name: "Project overview summary" })
  await expect(
    summary.getByRole("article").filter({ hasText: "Project Notes" }),
  ).toContainText("Data unavailable")
  await expect(
    summary.getByRole("article").filter({ hasText: "Client Requests" }),
  ).toContainText("Data unavailable")
  await expect(
    summary.getByRole("link", { name: "View project notes" }),
  ).toHaveCount(0)
  await expect(
    summary.getByRole("link", { name: "View client requests" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", {
      name: /rename|edit|approve|reject|release|upload|cancel|assign/i,
    }),
  ).toHaveCount(0)
  await expect(page.getByText("Project Oversight")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Manage project status" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: /Chat with client/ }),
  ).toHaveCount(0)
  await expect.poll(() => writes).toEqual([])
})
