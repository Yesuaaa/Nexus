import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test, type TestContext } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { readMigration, startPgliteApp } from "./support/pglite-app.js"

async function createProjectFixture(t: TestContext) {
  const { db, prisma, base } = await startPgliteApp(t)
  const [head, staff, lead, newLead, newHead, client] = await Promise.all(
    ["head", "staff", "lead", "new-lead", "new-head", "client"].map((name) =>
      prisma.user.create({
        data: {
          email: `${name}@example.com`,
          fullName: name,
          role: name === "client" ? "USER" : "STAFF",
          passwordHash: "test-only",
        },
      }),
    ),
  )
  const department = await prisma.department.create({
    data: { name: `Design-${randomUUID()}`, headId: head.id },
  })
  const employees = await Promise.all(
    [staff, lead, newLead].map((user, index) =>
      prisma.employee.create({
        data: {
          employeeId: `REVIEW-${index}-${randomUUID()}`,
          fullName: user.fullName!,
          userId: user.id,
          departmentId: department.id,
        },
      }),
    ),
  )
  const service = await prisma.service.create({
    data: {
      name: `Design-${randomUUID()}`,
      description: "Design service",
    },
  })
  const request = await prisma.serviceRequest.create({
    data: {
      clientId: client.id,
      serviceId: service.id,
      title: "Project review fixture",
      acceptedDepartmentId: department.id,
      workflow: { create: { state: "ACTIVE_PROJECT" } },
    },
  })
  const project = await prisma.project.create({
    data: {
      requestId: request.id,
      clientId: client.id,
      name: "Project review fixture",
      status: "IN_PROGRESS",
      startDate: new Date("2026-01-01T00:00:00Z"),
    },
  })
  await prisma.projectStaff.createMany({
    data: employees.map((employee, index) => ({
      projectId: project.id,
      employeeId: employee.id,
      approvedById: head.id,
      isTeamLead: index === 1,
    })),
  })
  const milestone = await prisma.projectMilestone.create({
    data: { projectId: project.id, title: "First concept" },
  })
  await prisma.projectChangeRequest.create({
    data: {
      projectId: project.id,
      requestedById: client.id,
      details: "Please adjust the project scope.",
    },
  })

  const tokens = new Map(
    await Promise.all(
      [head, staff, lead, newLead, newHead, client].map(
        async (user) => [user.id, (await issueSession(user)).token] as const,
      ),
    ),
  )
  async function api(
    userId: string,
    path: string,
    method = "GET",
    body?: unknown,
  ) {
    let token = tokens.get(userId)
    if (!token) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      })
      token = (await issueSession(user)).token
      tokens.set(userId, token)
    }
    return fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }
  return {
    api,
    client,
    db,
    department,
    head,
    lead,
    milestone,
    newHead,
    newLead,
    prisma,
    project,
    staff,
  }
}

test(
  "project notes require a separate reviewer and only approved client-visible revisions reach the client",
  { timeout: 120_000 },
  async (t) => {
    const {
      api,
      client,
      db,
      department,
      head,
      lead,
      milestone,
      newHead,
      newLead,
      prisma,
      project,
      staff,
    } = await createProjectFixture(t)
    const workspacePath = `/project-workspace/${project.id}`
    const notePath = `${workspacePath}/projects/${project.id}/notes`
    const created = await api(staff.id, notePath, "POST", {
      content: "Internal design note for review.",
    })
    assert.equal(created.status, 201)
    const createdWorkspace = (await created.json()) as {
      workstreams: {
        id: string
        notes: {
          id: string
          revisions: {
            id: string
            revision: number
            content: string
            status: string
            reviewedAt: string | null
            reviewedBy: { id: string; fullName: string | null } | null
            clientVisible: boolean
            publishedAt: string | null
            publishedById: string | null
            supersededAt: string | null
            supersededByRevisionId: string | null
            unpublishedAt: string | null
            unpublishedById: string | null
          }[]
        }[]
      }[]
    }
    const createdNote = createdWorkspace.workstreams.find(
      ({ id }) => id === project.id,
    )?.notes[0]
    assert.ok(createdNote)
    assert.equal(createdNote.revisions[0]?.status, "SUBMITTED")
    const pendingClientProject = await api(client.id, `/projects/${project.id}`)
    assert.equal(pendingClientProject.status, 200)
    assert.deepEqual(
      ((await pendingClientProject.json()) as { notes: unknown[] }).notes,
      [],
    )

    const selfReview = await api(
      staff.id,
      `${notePath}/${createdNote.id}/revisions/${createdNote.revisions[0]?.id}/review`,
      "PATCH",
      { action: "APPROVE", clientVisible: true },
    )
    assert.equal(selfReview.status, 403)

    const reviewPath = `${notePath}/${createdNote.id}/revisions/${createdNote.revisions[0]?.id}/review`
    const approved = await api(lead.id, reviewPath, "PATCH", {
      action: "APPROVE",
      clientVisible: true,
    })
    assert.equal(approved.status, 200)
    const approvedWorkspace = (await approved.json()) as typeof createdWorkspace
    const publishedRevision = approvedWorkspace.workstreams
      .find(({ id }) => id === project.id)
      ?.notes.find(({ id }) => id === createdNote.id)?.revisions[0]
    assert.ok(publishedRevision?.publishedAt)
    assert.equal(publishedRevision?.publishedById, lead.id)
    assert.ok(publishedRevision?.reviewedAt)
    assert.equal(publishedRevision?.reviewedBy?.id, lead.id)
    assert.equal(publishedRevision?.clientVisible, true)
    const clientProject = await api(client.id, `/projects/${project.id}`)
    const clientData = (await clientProject.json()) as {
      notes: { content: string }[]
    }
    assert.equal(clientData.notes.length, 1)
    assert.equal(
      clientData.notes[0]?.content,
      "Internal design note for review.",
    )

    const secondNote = await api(staff.id, notePath, "POST", {
      content: "A second note that needs department review.",
    })
    assert.equal(secondNote.status, 201)
    const secondWorkspace = (await secondNote.json()) as {
      workstreams: {
        id: string
        notes: {
          id: string
          revisions: { id: string; revision: number; content: string }[]
        }[]
      }[]
    }
    const second = secondWorkspace.workstreams
      .find(({ id }) => id === project.id)
      ?.notes.find(
        ({ revisions }) =>
          revisions[0]?.revision === 1 &&
          revisions[0]?.content ===
            "A second note that needs department review.",
      )
    assert.ok(second)
    const secondRevisionId = second.revisions[0]?.id
    const escalated = await api(
      lead.id,
      `${notePath}/${second.id}/revisions/${secondRevisionId}/escalate`,
      "POST",
    )
    assert.equal(escalated.status, 200)
    const headDecision = await api(
      head.id,
      `${notePath}/${second.id}/revisions/${secondRevisionId}/review`,
      "PATCH",
      { action: "APPROVE", clientVisible: false },
    )
    assert.equal(headDecision.status, 200)
    const escalatedNoteEvents = await prisma.workflowEvent.findMany({
      where: { entityId: secondRevisionId },
      select: { type: true, actorId: true },
    })
    assert.ok(
      escalatedNoteEvents.some(
        ({ type, actorId }) =>
          type === "PROJECT_NOTE_ESCALATED" && actorId === lead.id,
      ),
    )
    assert.ok(
      escalatedNoteEvents.some(
        ({ type, actorId }) =>
          type === "PROJECT_NOTE_APPROVED" && actorId === head.id,
      ),
    )
    const latestClientProject = await api(client.id, `/projects/${project.id}`)
    const latestClientData = (await latestClientProject.json()) as {
      notes: { content: string }[]
    }
    assert.equal(latestClientData.notes.length, 1)
    assert.equal(
      latestClientData.notes[0]?.content,
      "Internal design note for review.",
    )

    const revised = await api(
      staff.id,
      `${notePath}/${createdNote.id}/revisions`,
      "POST",
      { content: "Updated note approved for the client." },
    )
    assert.equal(revised.status, 201)
    const revisedWorkspace = (await revised.json()) as typeof createdWorkspace
    const revisedNote = revisedWorkspace.workstreams
      .find(({ id }) => id === project.id)
      ?.notes.find(({ id }) => id === createdNote.id)
    const newRevision = revisedNote?.revisions.find(
      ({ revision: number }) => number === 2,
    )
    assert.ok(newRevision)
    const newReviewPath = `${notePath}/${createdNote.id}/revisions/${newRevision.id}/review`
    const republished = await api(lead.id, newReviewPath, "PATCH", {
      action: "APPROVE",
      clientVisible: true,
    })
    assert.equal(republished.status, 200)
    const republishedWorkspace =
      (await republished.json()) as typeof createdWorkspace
    const publicationHistory = republishedWorkspace.workstreams
      .find(({ id }) => id === project.id)
      ?.notes.find(({ id }) => id === createdNote.id)?.revisions
    const firstPublication = publicationHistory?.find(
      ({ revision: number }) => number === 1,
    )
    const secondPublication = publicationHistory?.find(
      ({ revision: number }) => number === 2,
    )
    assert.ok(firstPublication)
    assert.ok(secondPublication)
    assert.equal(firstPublication?.publishedById, lead.id)
    assert.equal(firstPublication?.publishedAt, publishedRevision?.publishedAt)
    assert.equal(firstPublication?.reviewedBy?.id, lead.id)
    assert.ok(firstPublication?.reviewedAt)
    assert.ok(firstPublication?.supersededAt)
    assert.equal(firstPublication?.supersededByRevisionId, newRevision.id)
    assert.equal(secondPublication?.publishedById, lead.id)
    assert.ok(secondPublication?.publishedAt)
    assert.equal(secondPublication?.reviewedBy?.id, lead.id)
    assert.ok(secondPublication?.reviewedAt)
    assert.equal(secondPublication?.clientVisible, true)

    const currentClientProject = await api(client.id, `/projects/${project.id}`)
    const currentClientData = (await currentClientProject.json()) as {
      notes: { content: string }[]
    }
    assert.equal(currentClientData.notes.length, 1)
    assert.equal(
      currentClientData.notes[0]?.content,
      "Updated note approved for the client.",
    )
    const unpublished = await api(
      lead.id,
      `${notePath}/${createdNote.id}/revisions/${newRevision.id}/unpublish`,
      "POST",
    )
    assert.equal(unpublished.status, 200)
    const unpublishedRevision =
      await prisma.projectNoteRevision.findUniqueOrThrow({
        where: { id: newRevision.id },
      })
    assert.equal(unpublishedRevision.clientVisible, false)
    assert.equal(unpublishedRevision.unpublishedById, lead.id)
    assert.ok(unpublishedRevision.unpublishedAt)
    const noPublishedNotes = await api(client.id, `/projects/${project.id}`)
    assert.deepEqual(
      ((await noPublishedNotes.json()) as { notes: unknown[] }).notes,
      [],
    )
    const noteRevisionEvents = await prisma.workflowEvent.findMany({
      where: {
        entityId: { in: [firstPublication.id, secondPublication.id] },
        type: {
          in: [
            "PROJECT_NOTE_APPROVED",
            "PROJECT_NOTE_PUBLISHED",
            "PROJECT_NOTE_PUBLICATION_SUPERSEDED",
            "PROJECT_NOTE_UNPUBLISHED",
          ],
        },
      },
      select: { entityId: true, type: true, actorId: true },
    })
    for (const [revisionId, eventType] of [
      [firstPublication.id, "PROJECT_NOTE_APPROVED"],
      [firstPublication.id, "PROJECT_NOTE_PUBLISHED"],
      [firstPublication.id, "PROJECT_NOTE_PUBLICATION_SUPERSEDED"],
      [secondPublication.id, "PROJECT_NOTE_APPROVED"],
      [secondPublication.id, "PROJECT_NOTE_PUBLISHED"],
      [secondPublication.id, "PROJECT_NOTE_UNPUBLISHED"],
    ]) {
      assert.ok(
        noteRevisionEvents.some(
          ({ entityId, type, actorId }) =>
            entityId === revisionId &&
            type === eventType &&
            actorId === lead.id,
        ),
        `${eventType} should be recorded for revision ${revisionId}`,
      )
    }

    const outsideHead = await prisma.user.create({
      data: {
        email: "outside-head@example.com",
        fullName: "Outside Head",
        role: "STAFF",
        passwordHash: "test-only",
      },
    })
    await prisma.department.create({
      data: { name: `Outside-${randomUUID()}`, headId: outsideHead.id },
    })
    const outsiderResponse = await api(
      outsideHead.id,
      `${notePath}/${second.id}/revisions/${secondRevisionId}/review`,
      "PATCH",
      { action: "APPROVE", clientVisible: true },
    )
    assert.equal(outsiderResponse.status, 404)

    const existingPublishedNote = await prisma.projectNote.create({
      data: {
        projectId: project.id,
        createdById: staff.id,
        revisions: {
          create: {
            revision: 1,
            content: "Legacy published revision",
            authorId: staff.id,
            status: "APPROVED",
            reviewedById: lead.id,
            reviewedAt: new Date("2026-01-03T00:00:00Z"),
            clientVisible: true,
          },
        },
      },
      select: { revisions: { select: { id: true } } },
    })
    const legacyStatuses = [
      "NOT_SUBMITTED",
      "IN_REVIEW",
      "REJECTED",
      "APPROVED",
      "SENT_TO_CLIENT",
    ] as const
    const legacyRows: {
      status: (typeof legacyStatuses)[number]
      milestoneId: string
      fileId: string
      submittedAt: Date
      rejectionReason: string | null
    }[] = []
    for (const status of legacyStatuses) {
      const file = await prisma.workflowFile.create({
        data: {
          requestId: project.requestId!,
          uploaderId: staff.id,
          uploadId: randomUUID(),
          name: `legacy-${status.toLowerCase()}.txt`,
          mimeType: "text/plain",
          size: 6,
          sha256: "a".repeat(64),
          data: Buffer.from("legacy"),
          clientVisible: false,
        },
        select: { id: true, createdAt: true },
      })
      const reviewDate = new Date("2026-02-03T04:05:06Z")
      const rejectionReason =
        status === "REJECTED" ? "Legacy rejection feedback" : null
      const legacyMilestone = await prisma.projectMilestone.create({
        data: {
          projectId: project.id,
          title: `Legacy ${status}`,
          deliveryStatus: status,
          workflowFileId: file.id,
          reviewedById: ["REJECTED", "APPROVED", "SENT_TO_CLIENT"].includes(
            status,
          )
            ? head.id
            : null,
          reviewedAt: ["REJECTED", "APPROVED", "SENT_TO_CLIENT"].includes(
            status,
          )
            ? reviewDate
            : null,
          rejectionReason,
        },
        select: { id: true },
      })
      legacyRows.push({
        status,
        milestoneId: legacyMilestone.id,
        fileId: file.id,
        submittedAt: file.createdAt,
        rejectionReason,
      })
      if (status === "REJECTED" || status === "IN_REVIEW")
        await prisma.projectMessage.create({
          data: {
            projectId: project.id,
            senderId: staff.id,
            clientMessageId: randomUUID(),
            body:
              status === "REJECTED"
                ? "Legacy submission note"
                : "Submitted for review.",
            clientVisible: false,
            deliverable: {
              id: legacyMilestone.id,
              title: `Legacy ${status}`,
              fileId: file.id,
              fileName: `legacy-${status.toLowerCase()}.txt`,
              kind: "submission",
            },
          },
        })
    }
    const rejectedLegacy = legacyRows.find(
      ({ status }) => status === "REJECTED",
    )!
    await prisma.projectMessage.create({
      data: {
        projectId: project.id,
        senderId: staff.id,
        clientMessageId: randomUUID(),
        body: "Unrelated delivery message must not be copied.",
        clientVisible: true,
        deliverable: {
          id: rejectedLegacy.milestoneId,
          title: "Different file message",
          fileId: legacyRows.find(({ status }) => status === "APPROVED")!
            .fileId,
          fileName: "different.txt",
          kind: "delivery",
        },
      },
    })

    const initialMigration = await readMigration(
      "20261116090000_project_workspace_reviews",
    )
    const initialBackfillStart = initialMigration.indexOf(
      'INSERT INTO "ProjectDeliverableSubmission"',
    )
    const initialBackfillEnd = initialMigration.indexOf(
      'CREATE UNIQUE INDEX "ProjectDeliverableSubmission_workflowFileId_key"',
      initialBackfillStart,
    )
    assert.ok(
      initialBackfillStart >= 0 && initialBackfillEnd > initialBackfillStart,
    )
    await db.exec(
      initialMigration.slice(initialBackfillStart, initialBackfillEnd),
    )

    const correctionMigration = await readMigration(
      "20261116130000_project_workspace_review_integrity",
    )
    const repairMarker = "-- BEGIN LEGACY REVIEW DATA REPAIR"
    const repairEndMarker = "-- END LEGACY REVIEW DATA REPAIR"
    const repairStart = correctionMigration.indexOf(repairMarker)
    const repairEnd = correctionMigration.indexOf(repairEndMarker, repairStart)
    assert.ok(repairStart >= 0 && repairEnd > repairStart)
    await db.exec(
      correctionMigration.slice(repairStart + repairMarker.length, repairEnd),
    )

    const expectedLegacyStatus = {
      NOT_SUBMITTED: "WITHDRAWN",
      IN_REVIEW: "IN_REVIEW",
      REJECTED: "REJECTED",
      APPROVED: "APPROVED",
      SENT_TO_CLIENT: "SENT_TO_CLIENT",
    } as const
    for (const legacy of legacyRows) {
      const submission =
        await prisma.projectDeliverableSubmission.findUniqueOrThrow({
          where: { id: `legacy-${legacy.milestoneId}` },
        })
      assert.equal(submission.status, expectedLegacyStatus[legacy.status])
      assert.equal(submission.workflowFileId, legacy.fileId)
      assert.equal(submission.submittedById, staff.id)
      assert.equal(
        submission.submittedAt.toISOString(),
        legacy.submittedAt.toISOString(),
      )
      assert.equal(submission.version, 1)
      const hasReview = ["REJECTED", "APPROVED", "SENT_TO_CLIENT"].includes(
        legacy.status,
      )
      assert.equal(submission.reviewedById, hasReview ? head.id : null)
      assert.equal(
        submission.reviewedAt?.toISOString() ?? null,
        hasReview ? "2026-02-03T04:05:06.000Z" : null,
      )
      if (legacy.status === "REJECTED") {
        assert.equal(submission.feedback, legacy.rejectionReason)
        assert.equal(submission.note, "Legacy submission note")
      }
      if (legacy.status === "IN_REVIEW") assert.equal(submission.note, null)
      if (legacy.status === "APPROVED") assert.equal(submission.note, null)
    }
    const legacyPublishedRevision =
      await prisma.projectNoteRevision.findUniqueOrThrow({
        where: { id: existingPublishedNote.revisions[0]!.id },
      })
    assert.equal(
      legacyPublishedRevision.publishedAt?.toISOString(),
      "2026-01-03T00:00:00.000Z",
    )
    assert.equal(legacyPublishedRevision.publishedById, lead.id)

    const path = `/project-workspace/${project.id}/projects/${project.id}/deliverables/${milestone.id}`
    const upload = (uploadId: string, text: string) => ({
      uploadId,
      name: `${uploadId}.txt`,
      mimeType: "text/plain",
      content: Buffer.from(text).toString("base64"),
      note: `Version ${text}`,
    })
    const firstUpload = await api(
      staff.id,
      `${path}/attachment`,
      "POST",
      upload(randomUUID(), "first"),
    )
    assert.equal(firstUpload.status, 201)
    const firstFileId = (
      await prisma.projectMilestone.findUniqueOrThrow({
        where: { id: milestone.id },
        select: { workflowFileId: true },
      })
    ).workflowFileId
    assert.ok(firstFileId)

    const rejected = await api(lead.id, `${path}/reject`, "POST", {
      reason: "Please include the updated measurements.",
    })
    assert.equal(rejected.status, 200)
    const secondUpload = await api(
      staff.id,
      `${path}/attachment`,
      "POST",
      upload(randomUUID(), "second"),
    )
    assert.equal(secondUpload.status, 201)
    assert.ok(
      await prisma.workflowFile.findUnique({ where: { id: firstFileId } }),
    )
    const workspace = (await secondUpload.json()) as {
      workstreams: {
        milestones: {
          id: string
          submissions: {
            id: string
            status: string
            version: number
            note: string | null
            feedback: string | null
            reviewedAt: string | null
            reviewedBy: { id: string; fullName: string | null } | null
            workflowFile: { id: string }
          }[]
        }[]
      }[]
    }
    assert.equal(workspace.workstreams[0]?.milestones[0]?.submissions.length, 2)

    const previousSubmission =
      workspace.workstreams[0]?.milestones[0]?.submissions.find(
        ({ workflowFile }) => workflowFile.id === firstFileId,
      )
    assert.equal(previousSubmission?.status, "REJECTED")
    assert.equal(previousSubmission?.version, 1)
    assert.equal(previousSubmission?.note, "Version first")
    assert.equal(
      previousSubmission?.feedback,
      "Please include the updated measurements.",
    )
    assert.equal(previousSubmission?.reviewedBy?.id, lead.id)
    assert.ok(previousSubmission?.reviewedAt)
    const latestSubmission =
      workspace.workstreams[0]?.milestones[0]?.submissions.find(
        ({ workflowFile }) => workflowFile.id !== firstFileId,
      )
    assert.equal(latestSubmission?.version, 2)
    assert.equal(latestSubmission?.note, "Version second")
    assert.equal(latestSubmission?.status, "IN_REVIEW")
    const download = await api(
      lead.id,
      `${path}/submissions/${previousSubmission?.id}/attachment`,
    )
    assert.equal(download.status, 200)
    assert.equal(await download.text(), "first")

    const headCannotOverrideUnescalatedSubmission = await api(
      head.id,
      `${path}/approve`,
      "POST",
    )
    assert.equal(headCannotOverrideUnescalatedSubmission.status, 403)

    await t.test(
      "Team Lead reassignment revokes the former lead's review and escalation authority",
      async () => {
        const leadEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: lead.id },
          select: { id: true },
        })
        const newLeadEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: newLead.id },
          select: { id: true },
        })
        await prisma.$transaction([
          prisma.projectStaff.updateMany({
            where: { projectId: project.id, employeeId: leadEmployee.id },
            data: { isTeamLead: false },
          }),
          prisma.projectStaff.updateMany({
            where: { projectId: project.id, employeeId: newLeadEmployee.id },
            data: { isTeamLead: true },
          }),
        ])
        const formerLeadDecision = await api(lead.id, `${path}/approve`, "POST")
        assert.equal(formerLeadDecision.status, 403)
        const formerLeadEscalation = await api(
          lead.id,
          `${path}/escalate`,
          "POST",
        )
        assert.equal(formerLeadEscalation.status, 403)
        const currentMilestone =
          await prisma.projectMilestone.findUniqueOrThrow({
            where: { id: milestone.id },
            select: { deliveryStatus: true },
          })
        assert.equal(currentMilestone.deliveryStatus, "IN_REVIEW")
        assert.notEqual(leadEmployee.id, newLeadEmployee.id)
        const rejected = await api(newLead.id, `${path}/reject`, "POST", {
          reason: "Please revise the draft before approval.",
        })
        assert.equal(rejected.status, 200)
      },
    )

    await t.test(
      "Department Head reassignment revokes the former head's escalated-review authority",
      async () => {
        const nextUpload = await api(
          staff.id,
          `${path}/attachment`,
          "POST",
          upload(randomUUID(), "third"),
        )
        assert.equal(nextUpload.status, 201)
        const escalated = await api(newLead.id, `${path}/escalate`, "POST")
        assert.equal(escalated.status, 200)
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: newHead.id },
        })
        const formerHeadDecision = await api(head.id, `${path}/approve`, "POST")
        assert.ok([403, 404].includes(formerHeadDecision.status))
        const currentHeadDecision = await api(
          newHead.id,
          `${path}/approve`,
          "POST",
        )
        assert.equal(currentHeadDecision.status, 200)
        const finalMilestone = await prisma.projectMilestone.findUniqueOrThrow({
          where: { id: milestone.id },
          select: { deliveryStatus: true, reviewedById: true },
        })
        assert.equal(finalMilestone.deliveryStatus, "APPROVED")
        assert.equal(finalMilestone.reviewedById, newHead.id)
      },
    )

    await t.test(
      "concurrent approval and rejection decisions allow only one outcome",
      async () => {
        const concurrentMilestone = await prisma.projectMilestone.create({
          data: { projectId: project.id, title: "Concurrent review" },
          select: { id: true },
        })
        const concurrentPath = `/project-workspace/${project.id}/projects/${project.id}/deliverables/${concurrentMilestone.id}`
        const uploaded = await api(
          staff.id,
          `${concurrentPath}/attachment`,
          "POST",
          {
            uploadId: randomUUID(),
            name: "concurrent-review.txt",
            mimeType: "text/plain",
            content: Buffer.from("concurrent review").toString("base64"),
            note: "Concurrent decision fixture",
          },
        )
        assert.equal(uploaded.status, 201)
        const [approved, rejected] = await Promise.all([
          api(newLead.id, `${concurrentPath}/approve`, "POST"),
          api(newLead.id, `${concurrentPath}/reject`, "POST", {
            reason: "This concurrent decision should lose.",
          }),
        ])
        assert.deepEqual(
          [approved.status, rejected.status].sort(
            (left, right) => left - right,
          ),
          [200, 409],
        )
        const resultingMilestone =
          await prisma.projectMilestone.findUniqueOrThrow({
            where: { id: concurrentMilestone.id },
            select: { deliveryStatus: true, reviewedById: true },
          })
        assert.ok(
          ["APPROVED", "REJECTED"].includes(resultingMilestone.deliveryStatus),
        )
        assert.equal(resultingMilestone.reviewedById, newLead.id)
      },
    )

    await t.test(
      "client change and cancellation requests are reviewed only by the current Department Head",
      async () => {
        const changeRequest =
          await prisma.projectChangeRequest.findFirstOrThrow({
            where: { projectId: project.id, kind: "CHANGE" },
            select: { id: true },
          })
        const changePath = `/projects/${project.id}/change-requests/${changeRequest.id}`
        const clientChangeView = await api(client.id, `/projects/${project.id}`)
        assert.equal(clientChangeView.status, 200)
        const pendingClientProject = (await clientChangeView.json()) as {
          changeRequests: { id: string; status: string }[]
        }
        assert.equal(pendingClientProject.changeRequests[0]?.status, "PENDING")
        for (const reviewer of [staff, newLead, client, head]) {
          const denied = await api(reviewer.id, changePath, "PATCH", {
            decision: "ACCEPTED",
            responseNote: "This should be denied.",
          })
          assert.equal(denied.status, 403)
        }
        const acceptedChange = await api(newHead.id, changePath, "PATCH", {
          decision: "ACCEPTED",
          responseNote: "We will include this scope update.",
        })
        assert.equal(acceptedChange.status, 200)
        const approvedChange =
          await prisma.projectChangeRequest.findUniqueOrThrow({
            where: { id: changeRequest.id },
          })
        assert.equal(approvedChange.status, "ACCEPTED")
        assert.equal(approvedChange.reviewedById, newHead.id)
        assert.equal(
          approvedChange.responseNote,
          "We will include this scope update.",
        )

        const cancellation = await api(
          client.id,
          `/projects/${project.id}/cancellation-requests`,
          "POST",
          { details: "The client no longer needs the remaining project work." },
        )
        assert.equal(cancellation.status, 201)
        const cancellationId =
          await prisma.projectChangeRequest.findFirstOrThrow({
            where: { projectId: project.id, kind: "CANCELLATION" },
            select: { id: true },
          })
        const cancellationPath = `/projects/${project.id}/cancellation-requests/${cancellationId.id}`
        for (const reviewer of [staff, newLead, client, head]) {
          const denied = await api(reviewer.id, cancellationPath, "PATCH", {
            decision: "ACCEPTED",
            responseNote: "This should be denied.",
          })
          assert.equal(denied.status, 403)
        }
        const acceptedCancellation = await api(
          newHead.id,
          cancellationPath,
          "PATCH",
          {
            decision: "ACCEPTED",
            responseNote: "The request is approved.",
          },
        )
        assert.equal(acceptedCancellation.status, 200)
        const cancelledProject = (await acceptedCancellation.json()) as {
          status: string
          changeRequests: {
            id: string
            kind: string
            status: string
            responseNote: string | null
          }[]
        }
        assert.equal(cancelledProject.status, "CANCELLED")
        const cancelledRequest = cancelledProject.changeRequests.find(
          ({ id }) => id === cancellationId.id,
        )
        assert.equal(cancelledRequest?.kind, "CANCELLATION")
        assert.equal(cancelledRequest?.status, "ACCEPTED")
        assert.equal(cancelledRequest?.responseNote, "The request is approved.")
        const auditEvents = await prisma.workflowEvent.findMany({
          where: {
            entityId: project.id,
            type: {
              in: [
                "PROJECT_CANCELLATION_REQUESTED",
                "PROJECT_CANCELLATION_APPROVED",
              ],
            },
          },
          select: { type: true, actorId: true },
        })
        assert.ok(
          auditEvents.some(
            ({ type, actorId }) =>
              type === "PROJECT_CANCELLATION_REQUESTED" &&
              actorId === client.id,
          ),
        )
        assert.ok(
          auditEvents.some(
            ({ type, actorId }) =>
              type === "PROJECT_CANCELLATION_APPROVED" &&
              actorId === newHead.id,
          ),
        )
      },
    )
  },
)
