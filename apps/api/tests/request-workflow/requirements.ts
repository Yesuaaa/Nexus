import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { Prisma } from "../../src/generated/prisma/client.js"
import type { TestContext } from "node:test"
import type { WorkflowContext, TestWorkflow } from "./context.js"

/** Acceptance, requirements, consultations and private files. */
export async function acceptanceAndRequirements(
  t: TestContext,
  {
    path,
    get,
    head,
    accept,
    read,
    otherClient,
    staff,
    admin,
    otherAdmin,
    superadmin,
    client,
    anotherRequest,
    prisma,
    employee,
    act,
    state,
    send,
    upload,
    request,
  }: WorkflowContext,
) {
  await t.test(
    "acceptance initializes consultation without delivering a service or approving a quotation",
    async () => {
      assert.equal((await fetch(path())).status, 401)
      assert.equal((await get(head)).status, 404)
      assert.equal((await accept()).status, 200)
      const workflow = await read()
      assert.equal(workflow.state, "CONSULTATION")
      assert.equal(workflow.requirements.length, 0)
      assert.equal(
        workflow.events.some((event) => event.type === "REQUIREMENT_REQUESTED"),
        false,
      )
      assert.equal(workflow.approval, null)
      assert.equal(workflow.project, null)
      assert.ok(workflow.nextAction.length > 0)
      assert.equal(workflow.internal, undefined)
      for (const actor of [otherClient, staff, admin, otherAdmin, superadmin])
        assert.equal((await get(actor)).status, 404)
      for (const actor of [client, head, admin])
        assert.equal((await get(actor, anotherRequest.id)).status, 404)
    },
  )

  await t.test(
    "head workflow reads tolerate database latency beyond five seconds",
    async () => {
      const originalTransaction = prisma!.$transaction
      const transaction = prisma!.$transaction.bind(prisma!)
      Reflect.set(
        prisma!,
        "$transaction",
        async (
          operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: Parameters<typeof transaction>[1],
        ) =>
          transaction(async (tx) => {
            await new Promise<void>((resolve) => setTimeout(resolve, 5200))
            return operation(tx)
          }, options),
      )
      try {
        const workflow = await read(head)
        assert.equal(workflow.permissions.manage, true)
        assert.ok(
          workflow.internal?.staff.some((item) => item.id === employee.id),
        )
      } finally {
        Reflect.set(prisma!, "$transaction", originalTransaction)
      }
    },
  )

  await t.test(
    "requirements and consultations cannot be bypassed; files stay private and retry safely",
    async () => {
      const requested = await act(head, {
        type: "REQUEST_REQUIREMENT",
        title: "Brand guidelines",
        details: "Please provide your brand guidelines.",
        mandatory: true,
      })
      state.requirementId = requested.requirements[0]!.id
      const current = await read(head)
      assert.equal(
        (
          await send(
            client,
            {
              type: "REQUEST_REQUIREMENT",
              title: "Forged",
              details: "Please supply the requested documents.",
              mandatory: false,
            },
            current.version,
          )
        ).status,
        403,
      )
      assert.equal(
        (await send(head, { type: "PREPARE_QUOTATION" }, current.version))
          .status,
        409,
      )
      const uploadId = randomUUID()
      const file = await upload(
        client,
        "brand.txt",
        "Brand guidelines",
        request.id,
        uploadId,
      )
      state.submittedFileId = file.id
      assert.equal(
        (
          await upload(
            client,
            "brand.txt",
            "Brand guidelines",
            request.id,
            uploadId,
          )
        ).id,
        file.id,
      )
      assert.equal(
        await prisma!.workflowFile.count({
          where: { requestId: request.id },
        }),
        1,
      )
      const changedUpload = await fetch(`${path()}/files`, {
        method: "POST",
        headers: { ...client.headers, "content-type": "application/json" },
        body: JSON.stringify({
          uploadId,
          name: "brand.txt",
          mimeType: "text/plain",
          content: Buffer.from("Different document").toString("base64"),
        }),
      })
      assert.equal(changedUpload.status, 409)
      const privateDownload = await fetch(`${path()}/files/${file.id}`, {
        headers: client.headers,
      })
      assert.equal(privateDownload.status, 200)
      assert.equal(await privateDownload.text(), "Brand guidelines")
      assert.match(
        privateDownload.headers.get("content-disposition") || "",
        /attachment/,
      )
      for (const actor of [otherClient, otherAdmin, staff])
        assert.equal(
          (
            await fetch(`${path()}/files/${file.id}`, {
              headers: actor.headers,
            })
          ).status,
          404,
        )
      const formUpload = await fetch(`${path()}/files`, {
        method: "POST",
        headers: { ...client.headers, "content-type": "application/json" },
        body: JSON.stringify({
          uploadId: randomUUID(),
          name: "form.txt",
          mimeType: "text/plain",
          content: Buffer.from("Form attachment").toString("base64"),
          contextual: true,
        }),
      })
      assert.equal(formUpload.status, 201)
      const formFile = ((await formUpload.json()) as { file: { id: string } })
        .file
      assert.equal(
        (await read(client)).events.some(
          (event) =>
            event.type === "FILE_SUBMITTED" && event.entityId === formFile.id,
        ),
        false,
      )
      const submitted = await act(client, {
        type: "SUBMIT_REQUIREMENT",
        requirementId: state.requirementId,
        submission: "Please review our brand standards",
        fileId: file.id,
      })
      assert.equal(submitted.requirements[0]!.status, "SUBMITTED")
      assert.deepEqual(submitted.requirements[0]!.fileIds, [file.id])
      await act(head, {
        type: "REVIEW_REQUIREMENT",
        requirementId: state.requirementId,
        approve: false,
        note: "Include the latest logo",
      })
      assert.equal((await read()).requirements[0]!.status, "REQUESTED")
      const headFile = await upload(head, "head-only.txt")
      assert.equal((await accept(anotherRequest.id)).status, 200)
      const foreignFile = await upload(
        otherClient,
        "other-request.txt",
        "Other request",
        anotherRequest.id,
      )
      for (const invalidId of [headFile.id, foreignFile.id, "missing-file"]) {
        const before = await read()
        const denied = await send(
          client,
          {
            type: "SUBMIT_REQUIREMENT",
            requirementId: state.requirementId,
            submission: "Invalid attachment",
            fileIds: [file.id, invalidId],
          },
          before.version,
        )
        assert.equal(denied.status, 404)
        const after = await read()
        assert.equal(after.version, before.version)
        assert.equal(after.requirements[0]!.status, "REQUESTED")
        assert.deepEqual(after.requirements[0]!.fileIds, [file.id])
      }
      const fileIds = [file.id, formFile.id]
      for (let i = 0; i < 3; i++)
        fileIds.push((await upload(client, `support-${i}.txt`)).id)
      const batch = {
        type: "SUBMIT_REQUIREMENT",
        requirementId: state.requirementId,
        submission: "Latest logo included",
        fileIds,
      }
      const beforeBatch = await read()
      const batchActionId = randomUUID()
      for (let retry = 0; retry < 2; retry++) {
        const response = await send(
          client,
          batch,
          beforeBatch.version,
          batchActionId,
        )
        assert.equal(response.status, 200, await response.clone().text())
        const result = (await response.json()) as TestWorkflow
        assert.equal(result.version, beforeBatch.version + 1)
        assert.deepEqual(
          new Set(result.requirements[0]!.fileIds),
          new Set(fileIds),
        )
      }
      assert.deepEqual(
        new Set((await read(head)).requirements[0]!.fileIds),
        new Set(fileIds),
      )
      for (const fileId of fileIds)
        assert.equal(
          (
            await fetch(`${path()}/files/${fileId}`, {
              headers: head.headers,
            })
          ).status,
          200,
        )
      await act(head, {
        type: "REVIEW_REQUIREMENT",
        requirementId: state.requirementId,
        approve: false,
        note: "Replace supporting files",
      })
      const replacement = await act(client, {
        type: "SUBMIT_REQUIREMENT",
        requirementId: state.requirementId,
        submission: "Updated supporting document",
        fileIds: [formFile.id],
      })
      assert.deepEqual(replacement.requirements[0]!.fileIds, [formFile.id])
      await act(head, {
        type: "REVIEW_REQUIREMENT",
        requirementId: state.requirementId,
        approve: true,
        note: "Complete",
      })
      const afterRequirement = await read(head)
      assert.equal(
        (
          await send(
            head,
            { type: "PREPARE_QUOTATION" },
            afterRequirement.version,
          )
        ).status,
        409,
      )
      const scheduled = await act(head, {
        type: "SCHEDULE_CONSULTATION",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
        location: "Video meeting",
        notes: "Review goals",
      })
      const originalStartsAt = (
        await prisma!.workflowConsultation.findUniqueOrThrow({
          where: { id: scheduled.consultations[0]!.id },
        })
      ).startsAt.toISOString()
      const reschedule = {
        type: "REQUEST_CONSULTATION_RESCHEDULE",
        consultationId: scheduled.consultations[0]!.id,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        note: "Please move our meeting to tomorrow.",
      }
      assert.equal(
        (await send(head, reschedule, scheduled.version)).status,
        403,
      )
      assert.equal(
        (
          await send(
            client,
            {
              ...reschedule,
              startsAt: new Date(Date.now() - 1000).toISOString(),
            },
            scheduled.version,
          )
        ).status,
        400,
      )
      const rescheduled = await act(client, reschedule)
      assert.equal(rescheduled.consultations[0]!.status, "SCHEDULED")
      assert.equal(
        rescheduled.events.at(-1)!.type,
        "CONSULTATION_RESCHEDULE_REQUESTED",
      )
      assert.match(
        rescheduled.events.at(-1)!.summary,
        /existing schedule remains/,
      )
      assert.equal(
        (
          await prisma!.workflowConsultation.findUniqueOrThrow({
            where: { id: reschedule.consultationId },
          })
        ).startsAt.toISOString(),
        originalStartsAt,
      )
      assert.equal(
        (await send(client, reschedule, rescheduled.version)).status,
        409,
      )
      const response = {
        type: "RESPOND_CONSULTATION_RESCHEDULE",
        consultationId: reschedule.consultationId,
        requestEventId: (rescheduled.events.at(-1) as { id?: string }).id,
        approve: true,
        startsAt: reschedule.startsAt,
        endsAt: new Date(
          new Date(reschedule.startsAt).getTime() + 3600000,
        ).toISOString(),
        location: "https://meet.example.com/replacement",
        note: "Confirmed your preferred time.",
      }
      assert.equal(
        (await send(client, response, rescheduled.version)).status,
        403,
      )
      const confirmed = await act(head, response)
      assert.equal(
        confirmed.events.at(-1)!.type,
        "CONSULTATION_RESCHEDULE_CONFIRMED",
      )
      assert.equal(
        (
          await prisma!.workflowConsultation.findUniqueOrThrow({
            where: { id: reschedule.consultationId },
          })
        ).startsAt.toISOString(),
        reschedule.startsAt,
      )
      assert.equal((await send(head, response, confirmed.version)).status, 409)
      const secondRequest = await act(client, reschedule)
      const decline = {
        ...response,
        requestEventId: (secondRequest.events.at(-1) as { id?: string }).id,
        approve: false,
        note: "The department is unavailable at that time.",
      }
      assert.equal(
        (await send(head, { ...decline, note: "" }, secondRequest.version))
          .status,
        400,
      )
      const declined = await act(head, decline)
      assert.equal(
        declined.events.at(-1)!.type,
        "CONSULTATION_RESCHEDULE_DECLINED",
      )
      assert.equal(
        (
          await prisma!.workflowConsultation.findUniqueOrThrow({
            where: { id: reschedule.consultationId },
          })
        ).startsAt.toISOString(),
        reschedule.startsAt,
      )
      await prisma!.workflowConsultation.update({
        where: { id: scheduled.consultations[0]!.id },
        data: {
          startsAt: new Date(Date.now() - 7_200_000),
          endsAt: new Date(Date.now() - 3_600_000),
        },
      })
      await act(head, {
        type: "COMPLETE_CONSULTATION",
        consultationId: scheduled.consultations[0]!.id,
      })
      const prepared = await act(head, { type: "PREPARE_QUOTATION" })
      assert.equal(prepared.state, "QUOTATION_PENDING")
    },
  )
}
