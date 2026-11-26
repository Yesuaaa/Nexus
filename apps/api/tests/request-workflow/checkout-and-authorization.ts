import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type {
  WorkflowEvent,
  WorkflowFile,
  WorkflowPayment,
} from "../../src/generated/prisma/client.js"
import type { TestContext } from "node:test"
import type { WorkflowContext } from "./context.js"

/** Sandbox checkout, version checks, pauses and head handoffs. */
export async function checkoutAndAuthorization(
  t: TestContext,
  {
    prisma,
    department,
    client,
    accept,
    act,
    head,
    send,
    otherClient,
    read,
    path,
    service,
    replacement,
    get,
    state,
  }: WorkflowContext,
) {
  await t.test(
    "sandbox checkout requires server opt-in and preserves the existing staffing gate",
    async () => {
      for (const requiresAgreement of [false, true]) {
        const permittedEnvironment = requiresAgreement ? "development" : "test"
        process.env.NODE_ENV = permittedEnvironment
        process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR = "true"
        const sandboxService = await prisma!.service.create({
          data: {
            name: `Sandbox checkout ${requiresAgreement ? "with" : "without"} agreement`,
            description: "Prototype card checkout",
            requiresConsultation: false,
            requiresAgreement,
            requiresPayment: true,
            requiresQuotationApproval: false,
            departments: { connect: { id: department.id } },
          },
        })
        const sandboxRequest: { id: string } =
          await prisma!.serviceRequest.create({
            data: {
              clientId: client.id,
              serviceId: sandboxService.id,
              title: "Sandbox booking",
              pricingModel: "FIXED",
              agreedPrice: "5000.00",
              currency: "PHP",
            },
          })
        const id: string = sandboxRequest.id
        assert.equal((await accept(id)).status, 200)
        const proposed = await act(head, { type: "FIXED_QUOTATION" }, id)
        const command = { type: "COMPLETE_SANDBOX_PAYMENT" }
        assert.equal(
          (await send(client, command, proposed.version, randomUUID(), id))
            .status,
          409,
        )
        const approved = await act(
          client,
          {
            type: "RESPOND_QUOTATION",
            quotationId: proposed.quotations[0]!.id,
            decision: "ACCEPT",
            note: "",
          },
          id,
        )
        const pendingPayment = await prisma.workflowPayment.findUniqueOrThrow({
          where: { requestId: id },
        })
        const eventCount = await prisma.workflowEvent.count({
          where: { requestId: id },
        })
        const receiptCount = await prisma.workflowActionReceipt.count({
          where: { requestId: id },
        })
        const rejectedActionId = randomUUID()
        for (const scenario of [
          { environment: "production", optIn: "true" },
          { environment: "staging", optIn: "true" },
          { environment: undefined, optIn: "true" },
          { environment: permittedEnvironment, optIn: "false" },
          { environment: permittedEnvironment, optIn: undefined },
        ]) {
          if (scenario.environment === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = scenario.environment
          if (scenario.optIn === undefined)
            delete process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR
          else process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR = scenario.optIn
          const rejected = await send(
            client,
            command,
            approved.version,
            rejectedActionId,
            id,
          )
          assert.equal(rejected.status, 403)
          assert.match(await rejected.text(), /Sandbox checkout is disabled/)
        }
        process.env.NODE_ENV = permittedEnvironment
        process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR = "true"
        assert.equal(
          (await send(head, command, approved.version, randomUUID(), id))
            .status,
          403,
        )
        assert.equal(
          (await send(otherClient, command, approved.version, randomUUID(), id))
            .status,
          404,
        )
        await prisma.user.update({
          where: { id: client.id },
          data: { isActive: false },
        })
        try {
          assert.equal(
            (await send(client, command, approved.version, randomUUID(), id))
              .status,
            401,
          )
        } finally {
          await prisma.user.update({
            where: { id: client.id },
            data: { isActive: true },
          })
        }
        assert.deepEqual(
          await prisma.workflowPayment.findUniqueOrThrow({
            where: { requestId: id },
          }),
          pendingPayment,
        )
        assert.equal((await read(client, id)).version, approved.version)
        assert.equal(
          await prisma.workflowFile.count({ where: { requestId: id } }),
          0,
        )
        assert.equal(
          await prisma.workflowEvent.count({ where: { requestId: id } }),
          eventCount,
        )
        assert.equal(
          await prisma.workflowActionReceipt.count({
            where: { requestId: id },
          }),
          receiptCount,
        )
        const actionId = rejectedActionId
        const attempts = await Promise.all([
          send(client, command, approved.version, actionId, id),
          send(client, command, approved.version, actionId, id),
        ])
        for (const attempt of attempts)
          assert.equal(attempt.status, 200, await attempt.clone().text())
        const paid = await read(client, id)
        assert.equal(paid.payment!.status, "VERIFIED")
        assert.equal(paid.state, "READY_FOR_ACTIVATION")
        assert.equal(paid.agreement!.status, "APPROVED")
        const payment: WorkflowPayment =
          await prisma!.workflowPayment.findUniqueOrThrow({
            where: { requestId: id },
          })
        assert.match(payment.reference!, /^XENDIT-SANDBOX-[A-F0-9-]{36}$/)
        assert.ok(payment.verifiedAt)
        assert.equal(payment.verifiedById, null)
        const receipt: WorkflowFile =
          await prisma!.workflowFile.findUniqueOrThrow({
            where: { id: payment.proofFileId! },
          })
        const receiptText = Buffer.from(receipt.data).toString("utf8")
        assert.match(receiptText, /Status: Automatically verified/)
        assert.match(receiptText, /Amount: PHP 5000.00/)
        assert.ok(receiptText.includes(payment.reference!))
        assert.ok(!receiptText.includes("4000000000000002"))
        assert.equal(receipt.clientVisible, true)
        const download = await fetch(`${path(id)}/files/${receipt.id}`, {
          headers: client.headers,
        })
        assert.equal(download.status, 200)
        assert.equal(await download.text(), receiptText)
        const confirmations: WorkflowEvent[] =
          await prisma!.workflowEvent.findMany({
            where: { requestId: id, type: "PAYMENT_VERIFIED" },
          })
        assert.equal(confirmations.length, 1)
        assert.equal(confirmations[0]!.actorId, null)
        assert.equal(
          await prisma!.workflowFile.count({ where: { requestId: id } }),
          1,
        )
        assert.equal(
          (await send(client, command, paid.version, randomUUID(), id)).status,
          409,
        )
        assert.equal(
          (
            await send(
              head,
              { type: "ACTIVATE_PROJECT" },
              paid.version,
              randomUUID(),
              id,
            )
          ).status,
          409,
        )
        assert.equal(
          (
            await prisma!.project.findUniqueOrThrow({
              where: { requestId: id },
            })
          ).status,
          "PLANNED",
        )
      }
      delete process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR
    },
  )

  await t.test(
    "version checks, pause and department head handoffs enforce live authorization",
    async () => {
      const heldRequest = await prisma!.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: service.id,
          title: "Paused request",
        },
      })
      assert.equal((await accept(heldRequest.id)).status, 200)
      const initial = await read(head, heldRequest.id)
      const concurrent = await Promise.all([
        send(
          head,
          { type: "INTERNAL_NOTE", note: "Version race one" },
          initial.version,
          randomUUID(),
          heldRequest.id,
        ),
        send(
          head,
          { type: "INTERNAL_NOTE", note: "Version race two" },
          initial.version,
          randomUUID(),
          heldRequest.id,
        ),
      ])
      assert.deepEqual(
        concurrent.map((response) => response.status).sort(),
        [200, 409],
      )
      const before = await read(head, heldRequest.id)
      const held = await act(
        head,
        { type: "HOLD", note: "Awaiting client availability" },
        heldRequest.id,
      )
      assert.equal(held.state, "ON_HOLD")
      assert.equal(
        (
          await send(
            head,
            {
              type: "REQUEST_REQUIREMENT",
              title: "Extra",
              details: "Please supply the requested documents.",
              mandatory: true,
            },
            before.version,
            randomUUID(),
            heldRequest.id,
          )
        ).status,
        409,
      )
      const resumed = await act(
        head,
        { type: "RESUME", note: "Client available" },
        heldRequest.id,
      )
      assert.equal(resumed.state, "CONSULTATION")
      await prisma!.department.update({
        where: { id: department.id },
        data: { headId: replacement.id },
      })
      assert.equal((await get(head)).status, 404)
      assert.equal(
        (
          await fetch(`${path()}/files/${state.submittedFileId}`, {
            headers: head.headers,
          })
        ).status,
        404,
      )
      assert.equal((await get(replacement)).status, 200)
      const replacementView = await read(replacement)
      assert.ok(replacementView.internal)
      assert.equal((await get()).status, 200)
      await prisma!.department.update({
        where: { id: department.id },
        data: { headId: head.id },
      })
    },
  )
}
