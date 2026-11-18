import assert from "node:assert/strict"
import test from "node:test"
import {
  getProjectOverviewAttention,
  summarizeProjectOverview,
} from "../src/features/project-workspace/model/project-overview-summary.ts"

const baseRevision = (id, revision, status, authorId, extra = {}) => ({
  id,
  revision,
  status,
  authorId,
  clientVisible: false,
  publishedAt: null,
  unpublishedAt: null,
  supersededAt: null,
  ...extra,
})

const baseDeliverable = (
  id,
  status,
  submissionStatus = null,
  authorId = "staff",
) => ({
  id,
  deliveryStatus: status,
  workflowFileId: submissionStatus ? id + "-file" : null,
  workflowFile: null,
  submissions: submissionStatus
    ? [
        {
          id: id + "-submission",
          version: 1,
          status: submissionStatus,
          submittedAt: "2026-11-15T00:00:00.000Z",
          submittedById: authorId,
          workflowFile: { id: id + "-file" },
        },
      ]
    : [],
})

const note = (id, revisions) => ({ id, revisions })

function project(options = {}) {
  return {
    workstreams: [
      {
        taskCount: 3,
        completedTaskCount: 2,
        plan: {
          phases: [
            {
              tasks: [
                { id: "task-1", status: "DONE" },
                { id: "task-2", status: "DONE" },
                { id: "task-3", status: "IN_PROGRESS" },
              ],
            },
          ],
        },
        milestones: [
          baseDeliverable("sent", "SENT_TO_CLIENT", "SENT_TO_CLIENT"),
          baseDeliverable("approved", "APPROVED", "APPROVED"),
          baseDeliverable("review", "IN_REVIEW", "ESCALATED"),
          baseDeliverable("rejected", "REJECTED", "REJECTED", "actor"),
        ],
        notes: [
          note("revised", [
            baseRevision("r1", 1, "SUBMITTED", "actor", {
              supersededAt: "2026-11-15T00:00:00.000Z",
            }),
            baseRevision("r2", 2, "REVISION_REQUIRED", "actor"),
          ]),
          note("pending", [baseRevision("r3", 1, "SUBMITTED", "staff")]),
          note("published", [
            baseRevision("r4", 1, "APPROVED", "staff", {
              clientVisible: true,
              publishedAt: "2026-11-15T00:00:00.000Z",
            }),
            baseRevision("r5", 2, "APPROVED", "staff", {
              clientVisible: true,
              publishedAt: "2026-11-15T00:00:00.000Z",
            }),
          ]),
        ],
        changeRequests: [
          { id: "request-1", status: "PENDING" },
          { id: "request-2", status: "ACCEPTED" },
        ],
        canReviewRequests: true,
        ...options,
      },
    ],
  }
}

test("overview counts current revisions and client delivery separately from internal approval", () => {
  const summary = summarizeProjectOverview(project())

  assert.deepEqual(summary.tasks, { total: 3, completed: 2 })
  assert.deepEqual(summary.deliverables, {
    available: true,
    total: 4,
    sentToClient: 1,
    pendingReview: 1,
    revisionRequired: 1,
  })
  assert.deepEqual(summary.notes, {
    available: true,
    total: 3,
    awaitingReview: 1,
    published: 1,
  })
  assert.deepEqual(summary.requests, {
    available: true,
    total: 2,
    pending: 1,
    actionable: 1,
  })
})

test("missing Superadmin notes and requests remain unavailable instead of zero", () => {
  const data = project()
  delete data.workstreams[0].notes
  delete data.workstreams[0].changeRequests

  const summary = summarizeProjectOverview(data)
  assert.equal(summary.notes.available, false)
  assert.equal(summary.requests.available, false)
})

test("empty project records do not imply optional datasets were loaded", () => {
  const summary = summarizeProjectOverview({ workstreams: [] })
  assert.equal(summary.deliverables.available, false)
  assert.equal(summary.notes.available, false)
  assert.equal(summary.requests.available, false)
})

test("loaded empty collections are confirmed zero records", () => {
  const summary = summarizeProjectOverview({
    workstreams: [
      {
        taskCount: 0,
        completedTaskCount: 0,
        milestones: [],
        notes: [],
        changeRequests: [],
      },
    ],
  })

  assert.deepEqual(summary.deliverables, {
    available: true,
    total: 0,
    sentToClient: 0,
    pendingReview: 0,
    revisionRequired: 0,
  })
  assert.deepEqual(summary.notes, {
    available: true,
    total: 0,
    awaitingReview: 0,
    published: 0,
  })
  assert.deepEqual(summary.requests, {
    available: true,
    total: 0,
    pending: 0,
    actionable: 0,
  })
})

test("role attention uses the current person's revision and review permissions", () => {
  const staff = getProjectOverviewAttention(project(), "actor", "STAFF")
  const leadData = project({ isTeamLead: true, isDepartmentHead: false })
  leadData.workstreams[0].milestones[2].submissions[0].status = "IN_REVIEW"
  leadData.workstreams[0].milestones[2].submissions[0].submittedById = "staff"
  const lead = getProjectOverviewAttention(leadData, "actor", "STAFF")

  assert.ok(
    staff.items.some((item) => item.label === "Your note needs revision"),
  )
  assert.ok(
    staff.items.some((item) => item.label === "Your deliverable needs changes"),
  )
  assert.ok(
    lead.items.some(
      (item) => item.label === "1 note awaiting Team Lead review",
    ),
  )
  assert.ok(
    lead.items.some(
      (item) => item.label === "1 deliverable awaiting Team Lead review",
    ),
  )
})

test("Superadmin oversight is read-only and describes missing datasets", () => {
  const data = project()
  delete data.workstreams[0].notes
  delete data.workstreams[0].changeRequests

  const overview = getProjectOverviewAttention(data, "root", "SUPERADMIN")
  assert.equal(overview.heading, "Project Oversight")
  assert.ok(
    overview.items.some(
      (item) => item.label === "1 internal deliverable review pending",
    ),
  )
  assert.ok(
    overview.items.some(
      (item) => item.label === "Project note review history is unavailable",
    ),
  )
  assert.ok(
    overview.items.some(
      (item) => item.label === "Client request history is unavailable",
    ),
  )
})
