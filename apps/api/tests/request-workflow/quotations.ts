import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { WorkflowContext, TestWorkflow } from "./context.js"

/** Quotation control, formal acceptance and retries. */
export async function quotations(
  t: TestContext,
  {
    act,
    head,
    admin,
    paymentAdmin,
    quote,
    read,
    get,
    otherAdmin,
    otherClient,
    anotherRequest,
    state,
    path,
    send,
    upload,
    client,
    prisma,
    base,
    request,
    db,
  }: WorkflowContext,
) {
  await t.test(
    "quotation control is scoped and internal data never reaches the client",
    async () => {
      await act(head, {
        type: "ASSIGN_APPROVERS",
        quotationApproverId: admin.id,
        paymentVerifierId: paymentAdmin.id,
      })
      const created = await act(head, quote())
      assert.equal(created.quotations.at(-1)!.status, "PENDING_INTERNAL")
      const unpublishedQuotationId = created.quotations.at(-1)!.id
      const replacementQuote = await act(
        head,
        quote("Corrected internal draft scope"),
      )
      const quotationId = replacementQuote.quotations.at(-1)!.id
      assert.equal(
        replacementQuote.quotations.find(
          (row) => row.id === unpublishedQuotationId,
        )!.status,
        "SUPERSEDED",
      )
      const clientView = await read()
      assert.ok(
        !clientView.quotations.some((row) =>
          [quotationId, unpublishedQuotationId].includes(row.id),
        ),
      )
      assert.equal(clientView.internal, undefined)
      assert.equal((await get(otherAdmin)).status, 404)
      const quotationApprover = await read(admin)
      assert.equal(quotationApprover.permissions.approveQuotation, true)
      assert.equal(quotationApprover.permissions.verifyPayment, false)
      assert.equal(quotationApprover.payment, null)
      assert.equal(quotationApprover.agreement, null)
      assert.equal(quotationApprover.project, null)
      const paymentVerifier = await read(paymentAdmin)
      assert.equal(paymentVerifier.permissions.approveQuotation, false)
      assert.equal(paymentVerifier.permissions.verifyPayment, true)
      assert.equal(paymentVerifier.quotations.length, 0)
      assert.ok(
        !(await read(admin)).files.some(
          (file) => file.id === state.submittedFileId,
        ),
      )
      assert.equal(
        (
          await fetch(`${path()}/files/${state.submittedFileId}`, {
            headers: admin.headers,
          })
        ).status,
        404,
      )
      const current = await read(head)
      assert.equal(
        (
          await send(
            head,
            { type: "APPROVE_QUOTATION", quotationId },
            current.version,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await send(
            paymentAdmin,
            { type: "APPROVE_QUOTATION", quotationId },
            current.version,
          )
        ).status,
        403,
      )
      const approved = await act(admin, {
        type: "APPROVE_QUOTATION",
        quotationId,
      })
      assert.equal(approved.state, "CLIENT_APPROVAL")
      assert.equal((await read()).quotations.at(-1)!.status, "SENT")
      const financialFile = await upload(
        paymentAdmin,
        "finance.txt",
        "Confidential financial controls",
      )
      assert.ok(
        !(await read()).files.some((file) => file.id === financialFile.id),
      )
      assert.equal(
        (
          await fetch(`${path()}/files/${financialFile.id}`, {
            headers: client.headers,
          })
        ).status,
        404,
      )
      assert.equal(
        (
          await fetch(`${path()}/files/${financialFile.id}`, {
            headers: paymentAdmin.headers,
          })
        ).status,
        200,
      )
      await act(head, {
        type: "INTERNAL_NOTE",
        note: "Private staffing cost estimate",
      })
      const serialized = JSON.stringify(await read())
      assert.ok(!serialized.includes("Private staffing cost estimate"))
      assert.ok(!serialized.includes("payloadHash"))
      assert.ok(!serialized.includes("sha256"))
      assert.ok(!serialized.includes("passwordHash"))
      assert.ok(!serialized.includes("clientVisible"))
      // PG-016-F001-A011-T001: independent protected-file identity and bytes.
      const proofName = "PG-016 résumé (copy).txt"
      const proofContent = "Synthetic client receipt only."
      const publicProof = await upload(client, proofName, proofContent)
      const downloaded = await fetch(`${path()}/files/${publicProof.id}`, {
        headers: client.headers,
      })
      assert.equal(downloaded.status, 200)
      assert.equal(await downloaded.text(), proofContent)
      assert.equal(
        downloaded.headers.get("content-type"),
        "text/plain; charset=utf-8",
      )
      assert.equal(
        downloaded.headers.get("content-length"),
        String(Buffer.byteLength(proofContent)),
      )
      assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff")
      assert.equal(
        downloaded.headers.get("content-security-policy"),
        "sandbox; default-src 'none'",
      )
      assert.equal(
        downloaded.headers.get("content-disposition"),
        "attachment; filename=\"download.txt\"; filename*=UTF-8''PG-016%20r%C3%A9sum%C3%A9%20%28copy%29.txt",
      )
      for (const [requestId, fileId, actor] of [
        [request.id, publicProof.id, otherClient],
        [anotherRequest.id, publicProof.id, otherClient],
        [request.id, "pg016-missing", client],
      ] as const) {
        const denied = await fetch(`${path(requestId)}/files/${fileId}`, {
          headers: actor.headers,
        })
        assert.equal(denied.status, 404)
        const text = await denied.text()
        assert.ok(!text.includes(proofContent))
        assert.ok(!text.includes(proofName))
      }
    },
  )

  await t.test(
    "only the latest valid quotation can be formally accepted; retries do not duplicate decisions",
    async () => {
      const first = (await read()).quotations.at(-1)!
      const revised = await act(client, {
        type: "RESPOND_QUOTATION",
        quotationId: first.id,
        decision: "REVISE",
        note: "Include accessibility testing",
      })
      assert.equal(revised.state, "REVISION_REQUESTED")
      const second = await act(
        head,
        quote("Build an accessible and tested website"),
      )
      const latest = second.quotations.at(-1)!
      assert.equal(latest.version, first.version + 1)
      await act(admin, { type: "APPROVE_QUOTATION", quotationId: latest.id })
      const current = await read()
      assert.equal(
        (
          await send(
            client,
            {
              type: "RESPOND_QUOTATION",
              quotationId: first.id,
              decision: "ACCEPT",
              note: "",
            },
            current.version,
          )
        ).status,
        409,
      )
      await prisma!.workflowQuotation.update({
        where: { id: latest.id },
        data: { validUntil: new Date(Date.now() - 1000) },
      })
      assert.equal(
        (
          await send(
            client,
            {
              type: "RESPOND_QUOTATION",
              quotationId: latest.id,
              decision: "ACCEPT",
              note: "",
            },
            current.version,
          )
        ).status,
        409,
      )
      await prisma!.workflowQuotation.update({
        where: { id: latest.id },
        data: { validUntil: new Date(Date.now() + 86_400_000) },
      })
      const message = await fetch(
        `${base}/request-conversations/${request.id}/messages`,
        {
          method: "POST",
          headers: { ...client.headers, "content-type": "application/json" },
          body: JSON.stringify({
            body: "I approve this quotation",
            clientMessageId: randomUUID(),
          }),
        },
      )
      assert.equal(message.status, 201)
      assert.equal((await read()).approval, null)
      const actionId = randomUUID()
      const responseAction = {
        type: "RESPOND_QUOTATION",
        quotationId: latest.id,
        decision: "ACCEPT",
        note: "",
      }
      const accepted = await send(
        client,
        responseAction,
        current.version,
        actionId,
      )
      assert.equal(accepted.status, 200, await accepted.clone().text())
      const acceptedBody = (await accepted.json()) as TestWorkflow
      assert.equal(acceptedBody.state, "AGREEMENT_PAYMENT_PENDING")
      assert.equal(acceptedBody.agreement!.status, "APPROVED")
      assert.equal(Number(acceptedBody.approval!.amount), 30000)
      assert.equal(acceptedBody.approval!.approvedById, client.id)
      assert.ok(acceptedBody.approval!.approvedAt)
      state.acceptedQuotationId = latest.id
      assert.equal(
        (await send(client, responseAction, current.version, actionId)).status,
        200,
      )
      assert.equal(
        (
          await send(
            client,
            { ...responseAction, decision: "DECLINE" },
            current.version,
            actionId,
          )
        ).status,
        409,
      )
      assert.equal(
        await prisma!.workflowApproval.count({
          where: { requestId: request.id },
        }),
        1,
      )
      assert.equal(
        await prisma!.project.count({ where: { requestId: request.id } }),
        1,
      )
      assert.equal(acceptedBody.project, null)
      const draft = await prisma!.project.findUniqueOrThrow({
        where: { requestId: request.id },
      })
      assert.equal((await read(admin)).payment, null)
      assert.equal((await read(admin)).agreement, null)
      const paymentView = await read(paymentAdmin)
      assert.equal(paymentView.quotations.length, 1)
      assert.equal(paymentView.quotations[0]!.status, "ACCEPTED")
      assert.equal(
        (
          await fetch(`${base}/projects/${draft.id}`, {
            headers: client.headers,
          })
        ).status,
        404,
      )
      await assert.rejects(
        db.query(
          'UPDATE "WorkflowApproval" SET "amount" = 1 WHERE "requestId" = $1',
          [request.id],
        ),
        /immutable/,
      )
      await assert.rejects(
        db.query('DELETE FROM "WorkflowApproval" WHERE "requestId" = $1', [
          request.id,
        ]),
        /immutable/,
      )
    },
  )
}
