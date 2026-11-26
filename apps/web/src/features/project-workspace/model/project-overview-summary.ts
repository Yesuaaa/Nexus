import type {
  ProjectDeliverable,
  ProjectWorkspaceDetail,
  ProjectWorkspaceNote,
  ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"

export type ProjectOverviewSection =
  "work" | "deliverables" | "notes" | "requests" | "team" | "activity"

export type ProjectOverviewAttentionItem = {
  id: string
  label: string
  section: ProjectOverviewSection
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function hasCollection(
  workstreams: ProjectWorkspaceWorkstream[],
  key: "milestones" | "notes" | "changeRequests",
) {
  return (
    workstreams.length > 0 &&
    workstreams.every((workstream) => Array.isArray(workstream[key]))
  )
}

function latestRevision(note: ProjectWorkspaceNote) {
  return [...note.revisions].sort(
    (left, right) => right.revision - left.revision,
  )[0]
}

function currentSubmission(deliverable: ProjectDeliverable) {
  const submissions = deliverable.submissions ?? []
  const fileId = deliverable.workflowFile?.id ?? deliverable.workflowFileId
  const current = fileId
    ? submissions.find((submission) => submission.workflowFile.id === fileId)
    : undefined
  return (
    current ??
    [...submissions].sort(
      (left, right) =>
        right.version - left.version ||
        right.submittedAt.localeCompare(left.submittedAt),
    )[0]
  )
}

function notesFor(workstreams: ProjectWorkspaceWorkstream[]) {
  return uniqueById(workstreams.flatMap((workstream) => workstream.notes ?? []))
}

function deliverablesFor(workstreams: ProjectWorkspaceWorkstream[]) {
  return workstreams.flatMap((workstream) => workstream.milestones ?? [])
}

export function summarizeProjectOverview(workspace: ProjectWorkspaceDetail) {
  const workstreams = workspace.workstreams
  const tasks = workstreams.reduce(
    (counts, workstream) => {
      if (workstream.plan) {
        const planned = workstream.plan.phases.flatMap((phase) => phase.tasks)
        return {
          total: counts.total + planned.length,
          completed:
            counts.completed +
            planned.filter((task) => task.status === "DONE").length,
        }
      }
      return {
        total: counts.total + workstream.taskCount,
        completed: counts.completed + workstream.completedTaskCount,
      }
    },
    { total: 0, completed: 0 },
  )
  tasks.completed = Math.min(tasks.completed, tasks.total)
  const deliverablesAvailable = hasCollection(workstreams, "milestones")
  const deliverables = deliverablesFor(workstreams)
  const notesAvailable = hasCollection(workstreams, "notes")
  const notes = notesAvailable ? notesFor(workstreams) : []
  const requestsAvailable = hasCollection(workstreams, "changeRequests")
  const requests = requestsAvailable
    ? uniqueById(
        workstreams.flatMap((workstream) => workstream.changeRequests ?? []),
      )
    : []

  return {
    tasks,
    deliverables: {
      available: deliverablesAvailable,
      total: deliverables.length,
      sentToClient: deliverables.filter(
        (deliverable) => deliverable.deliveryStatus === "SENT_TO_CLIENT",
      ).length,
      pendingReview: deliverables.filter((deliverable) => {
        const status =
          currentSubmission(deliverable)?.status ?? deliverable.deliveryStatus
        return status === "IN_REVIEW" || status === "ESCALATED"
      }).length,
      revisionRequired: deliverables.filter((deliverable) => {
        const status =
          currentSubmission(deliverable)?.status ?? deliverable.deliveryStatus
        return status === "REJECTED"
      }).length,
    },
    notes: {
      available: notesAvailable,
      total: notes.length,
      awaitingReview: notes.filter((note) => {
        const status = latestRevision(note)?.status
        return status === "SUBMITTED" || status === "ESCALATED"
      }).length,
      published: notes.filter((note) =>
        note.revisions.some(
          (revision) =>
            revision.status === "APPROVED" &&
            revision.clientVisible &&
            revision.publishedAt !== null &&
            revision.unpublishedAt === null &&
            revision.supersededAt === null,
        ),
      ).length,
    },
    requests: {
      available: requestsAvailable,
      total: requests.length,
      pending: requests.filter((request) => request.status === "PENDING")
        .length,
      actionable: uniqueById(
        workstreams
          .filter((workstream) => workstream.canReviewRequests === true)
          .flatMap((workstream) =>
            (workstream.changeRequests ?? []).filter(
              (request) => request.status === "PENDING",
            ),
          ),
      ).length,
    },
  }
}

export function getProjectOverviewAttention(
  workspace: ProjectWorkspaceDetail,
  actorId: string,
  role: string,
): {
  heading: "Requires Attention" | "Project Oversight"
  items: ProjectOverviewAttentionItem[]
} {
  const counts = summarizeProjectOverview(workspace)
  const workstreams = workspace.workstreams
  const items: ProjectOverviewAttentionItem[] = []
  const add = (id: string, label: string, section: ProjectOverviewSection) => {
    if (!items.some((item) => item.id === id || item.label === label))
      items.push({ id, label, section })
  }

  if (role === "SUPERADMIN") {
    if (counts.deliverables.available && counts.deliverables.pendingReview)
      add(
        "oversight-deliverable-reviews",
        counts.deliverables.pendingReview +
          " internal deliverable " +
          (counts.deliverables.pendingReview === 1 ? "review" : "reviews") +
          " pending",
        "deliverables",
      )
    if (counts.notes.available && counts.notes.awaitingReview)
      add(
        "oversight-note-reviews",
        counts.notes.awaitingReview + " note reviews pending",
        "notes",
      )
    const escalatedNotes = counts.notes.available
      ? notesFor(workstreams).filter(
          (note) => latestRevision(note)?.status === "ESCALATED",
        ).length
      : 0
    const escalatedDeliverables = counts.deliverables.available
      ? deliverablesFor(workstreams).filter(
          (deliverable) =>
            currentSubmission(deliverable)?.status === "ESCALATED",
        ).length
      : 0
    if (escalatedNotes)
      add(
        "oversight-escalated-notes",
        escalatedNotes + " escalated notes",
        "notes",
      )
    if (escalatedDeliverables)
      add(
        "oversight-escalated-deliverables",
        escalatedDeliverables + " escalated deliverables",
        "deliverables",
      )
    if (counts.requests.available && counts.requests.pending)
      add(
        "oversight-requests",
        counts.requests.pending + " outstanding client requests",
        "requests",
      )
    if (!counts.notes.available)
      add(
        "oversight-notes-unavailable",
        "Project note review history is unavailable",
        "notes",
      )
    if (!counts.requests.available)
      add(
        "oversight-requests-unavailable",
        "Client request history is unavailable",
        "requests",
      )
    return { heading: "Project Oversight", items }
  }

  const departmentStreams = workstreams.filter(
    (workstream) => workstream.isDepartmentHead,
  )
  if (departmentStreams.length) {
    const escalatedNotes = notesFor(departmentStreams).filter(
      (note) => latestRevision(note)?.status === "ESCALATED",
    )
    const escalatedDeliverables = departmentStreams.flatMap((workstream) =>
      (workstream.milestones ?? []).filter((deliverable) => {
        const status =
          currentSubmission(deliverable)?.status ?? deliverable.deliveryStatus
        return status === "ESCALATED"
      }),
    )
    const requests = uniqueById(
      departmentStreams.flatMap((workstream) =>
        (workstream.changeRequests ?? []).filter(
          (request) =>
            workstream.canReviewRequests === true &&
            request.status === "PENDING",
        ),
      ),
    )
    if (escalatedNotes.length)
      add(
        "department-escalated-notes",
        escalatedNotes.length +
          " escalated " +
          (escalatedNotes.length === 1 ? "note" : "notes"),
        "notes",
      )
    if (escalatedDeliverables.length)
      add(
        "department-escalated-deliverables",
        escalatedDeliverables.length +
          " escalated " +
          (escalatedDeliverables.length === 1 ? "deliverable" : "deliverables"),
        "deliverables",
      )
    if (requests.length)
      add(
        "department-client-requests",
        requests.length +
          " client " +
          (requests.length === 1 ? "request needs" : "requests need") +
          " your decision",
        "requests",
      )
    if (!counts.notes.available && departmentStreams.length)
      add(
        "department-notes-unavailable",
        "Project note review history is unavailable",
        "notes",
      )
    if (!counts.deliverables.available && departmentStreams.length)
      add(
        "department-deliverables-unavailable",
        "Deliverable review history is unavailable",
        "deliverables",
      )
    if (!counts.requests.available && departmentStreams.length)
      add(
        "department-requests-unavailable",
        "Client request history is unavailable",
        "requests",
      )
  }

  const reviewableStreams = workstreams.filter(
    (workstream) => workstream.isTeamLead,
  )
  if (reviewableStreams.length) {
    const noteReviews = reviewableStreams.flatMap((workstream) =>
      (workstream.notes ?? []).filter((note) => {
        const revision = latestRevision(note)
        return revision?.status === "SUBMITTED" && revision.authorId !== actorId
      }),
    )
    const deliverableReviews = reviewableStreams.flatMap((workstream) =>
      (workstream.milestones ?? []).filter((deliverable) => {
        const submission = currentSubmission(deliverable)
        return (
          submission?.status === "IN_REVIEW" &&
          submission.submittedById !== actorId
        )
      }),
    )
    if (noteReviews.length)
      add(
        "team-lead-note-reviews",
        noteReviews.length +
          " " +
          (noteReviews.length === 1 ? "note" : "notes") +
          " awaiting Team Lead review",
        "notes",
      )
    if (deliverableReviews.length)
      add(
        "team-lead-deliverable-reviews",
        deliverableReviews.length +
          " " +
          (deliverableReviews.length === 1 ? "deliverable" : "deliverables") +
          " awaiting Team Lead review",
        "deliverables",
      )
    if (!counts.notes.available)
      add(
        "team-lead-notes-unavailable",
        "Project note review history is unavailable",
        "notes",
      )
    if (!counts.deliverables.available)
      add(
        "team-lead-deliverables-unavailable",
        "Deliverable review history is unavailable",
        "deliverables",
      )
  }

  const notesNeedingRevision = notesFor(workstreams).filter((note) => {
    const revision = latestRevision(note)
    return (
      revision?.authorId === actorId &&
      (revision.status === "REVISION_REQUIRED" ||
        revision.status === "REJECTED")
    )
  })
  const deliverablesNeedingRevision = workstreams.flatMap((workstream) =>
    (workstream.milestones ?? []).filter((deliverable) => {
      const submission = currentSubmission(deliverable)
      return (
        submission?.status === "REJECTED" &&
        submission.submittedById === actorId
      )
    }),
  )
  const assignedTaskTotal = counts.tasks.total
  if (assignedTaskTotal)
    add(
      "staff-task-assignment-unavailable",
      "Your task assignment can't be matched in this overview.",
      "work",
    )
  if (notesNeedingRevision.length)
    add(
      "staff-note-revision",
      notesNeedingRevision.length === 1
        ? "Your note needs revision"
        : notesNeedingRevision.length + " of your notes need revision",
      "notes",
    )
  if (deliverablesNeedingRevision.length)
    add(
      "staff-deliverable-revision",
      deliverablesNeedingRevision.length === 1
        ? "Your deliverable needs changes"
        : deliverablesNeedingRevision.length +
            " of your deliverables need changes",
      "deliverables",
    )
  return { heading: "Requires Attention", items }
}
