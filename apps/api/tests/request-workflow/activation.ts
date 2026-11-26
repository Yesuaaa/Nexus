import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { WorkflowContext, Actor } from "./context.js"

/** Agreement, payment, project activation and staffing. */
export async function activationAndStaffing(
  t: TestContext,
  {
    read,
    head,
    send,
    inactiveEmployee,
    foreignEmployee,
    act,
    employee,
    client,
    state,
    upload,
    admin,
    prisma,
    request,
    base,
    otherClient,
    staff,
    foreignDepartment,
    department,
    paymentAdmin,
    user,
  }: WorkflowContext,
) {
  await t.test(
    "quotation acceptance satisfies agreement while payment and staffing block premature activation",
    async () => {
      const current = await read(head)
      assert.equal(
        (await send(head, { type: "ACTIVATE_PROJECT" }, current.version))
          .status,
        409,
      )
      for (const invalid of [inactiveEmployee.id, foreignEmployee.id])
        assert.equal(
          (
            await send(
              head,
              { type: "STAFF_PROJECT", employeeIds: [invalid] },
              current.version,
            )
          ).status,
          409,
        )
      await act(head, { type: "STAFF_PROJECT", employeeIds: [employee.id] })
      assert.equal((await read(client)).agreement!.status, "APPROVED")
      const submitted = await act(client, {
        type: "SUBMIT_PAYMENT",
        fileId: state.submittedFileId,
        reference: "XENDIT-SANDBOX-TEST",
      })
      assert.equal(submitted.payment!.status, "SUBMITTED")
      const proof = await upload(
        client,
        "receipt.txt",
        "Manual bank payment proof",
      )
      const beforeVerification = await read(head)
      assert.equal(
        (
          await send(
            client,
            { type: "COMPLETE_SANDBOX_PAYMENT" },
            beforeVerification.version,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await send(
            client,
            {
              type: "SUBMIT_PAYMENT",
              fileId: proof.id,
              reference: "REPLACEMENT",
            },
            beforeVerification.version,
          )
        ).status,
        409,
      )
      assert.equal(
        (
          await send(
            admin,
            {
              type: "VERIFY_PAYMENT",
              approve: true,
              note: "No verifier grant",
            },
            beforeVerification.version,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await send(
            head,
            {
              type: "VERIFY_PAYMENT",
              approve: false,
              note: "",
            },
            beforeVerification.version,
          )
        ).status,
        400,
      )
      assert.equal(
        (
          await send(
            client,
            { type: "VERIFY_PAYMENT", approve: true, note: "" },
            beforeVerification.version,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await send(
            head,
            { type: "ACTIVATE_PROJECT" },
            beforeVerification.version,
          )
        ).status,
        409,
      )
      const returned = await act(head, {
        type: "VERIFY_PAYMENT",
        approve: false,
        note: "Receipt amount does not match",
      })
      assert.equal(returned.payment!.status, "PENDING")
      assert.ok(
        (await read(client)).events.some((event) =>
          event.summary.includes("Receipt amount does not match"),
        ),
      )
      await act(client, {
        type: "SUBMIT_PAYMENT",
        fileId: proof.id,
        reference: "BANK-WF-001",
      })
      const ready = await act(head, {
        type: "VERIFY_PAYMENT",
        approve: true,
        note: "Bank deposit confirmed",
      })
      assert.equal(ready.payment!.status, "VERIFIED")
      assert.equal(ready.state, "READY_FOR_ACTIVATION")
      assert.equal(ready.project!.status, "PLANNED")
      assert.equal((await read(head)).project!.status, "PLANNED")
      assert.equal((await read()).project, null)
      const manager = await read(head)
      const response = await send(
        admin,
        { type: "ACTIVATE_PROJECT" },
        manager.version,
      )
      assert.equal(response.status, 403)
      const activationId = randomUUID()
      const activations = await Promise.all([
        send(head, { type: "ACTIVATE_PROJECT" }, manager.version, activationId),
        send(head, { type: "ACTIVATE_PROJECT" }, manager.version, activationId),
      ])
      for (const activation of activations)
        assert.equal(activation.status, 200, await activation.clone().text())
      const active = await read()
      assert.equal(active.state, "ACTIVE_PROJECT")
      assert.equal(active.project!.status, "IN_PROGRESS")
      state.projectId = active.project!.id
      assert.equal(
        await prisma!.project.count({ where: { requestId: request.id } }),
        1,
      )
      assert.equal(
        await prisma!.projectMilestone.count({
          where: { projectId: state.projectId },
        }),
        2,
      )
      const persisted = await prisma!.project.findUniqueOrThrow({
        where: { id: state.projectId },
      })
      assert.equal(persisted.quotationId, state.acceptedQuotationId)
      assert.ok(
        active.events.some((event) => event.type === "PROJECT_ACTIVATED"),
      )
      assert.equal(active.internal, undefined)
      const workspace = await fetch(`${base}/projects/${state.projectId}`, {
        headers: client.headers,
      })
      assert.equal(workspace.status, 200)
      const workspaceJson = await workspace.text()
      assert.ok(!workspaceJson.includes("Private staffing cost estimate"))
      assert.ok(!workspaceJson.includes(employee.id))
      assert.equal(
        (
          await fetch(`${base}/projects/${state.projectId}`, {
            headers: otherClient.headers,
          })
        ).status,
        404,
      )
      const clientProject = JSON.parse(workspaceJson) as {
        milestones: unknown[]
        canManage: boolean
      }
      assert.deepEqual(clientProject.milestones, [])
      assert.equal(clientProject.canManage, false)
      const staffWorkspace = await fetch(
        `${base}/projects/${state.projectId}`,
        {
          headers: staff.headers,
        },
      )
      assert.equal(staffWorkspace.status, 200)
      const { milestones } = (await staffWorkspace.json()) as {
        milestones: { id: string; completedAt: string | null }[]
      }
      assert.equal(milestones.length, 2)
      const milestoneId = milestones[0]!.id
      const patchMilestone = (actor: Actor, completed: boolean) =>
        fetch(`${base}/projects/${state.projectId}/milestones/${milestoneId}`, {
          method: "PATCH",
          headers: { ...actor.headers, "content-type": "application/json" },
          body: JSON.stringify({ completed }),
        })
      assert.equal((await patchMilestone(client, true)).status, 404)
      const completed = await patchMilestone(staff, true)
      assert.equal(completed.status, 200, await completed.clone().text())
      assert.ok(
        (
          (await completed.json()) as {
            milestones: { completedAt: string | null }[]
          }
        ).milestones[0]!.completedAt,
      )
      const reopened = await patchMilestone(staff, false)
      assert.equal(reopened.status, 200)
      assert.equal(
        (
          (await reopened.json()) as {
            milestones: { completedAt: string | null }[]
          }
        ).milestones[0]!.completedAt,
        null,
      )
      await prisma!.employee.update({
        where: { id: employee.id },
        data: { departmentId: foreignDepartment.id },
      })
      assert.equal(
        (
          await fetch(`${base}/projects/${state.projectId}`, {
            headers: staff.headers,
          })
        ).status,
        404,
      )
      assert.equal((await patchMilestone(staff, true)).status, 404)
      await prisma!.employee.update({
        where: { id: employee.id },
        data: { departmentId: department.id },
      })
    },
  )

  await t.test(
    "department heads can update active service staffing without creating another workspace",
    async () => {
      const current = await read(head)
      assert.equal(current.state, "ACTIVE_PROJECT")
      for (const actor of [client, paymentAdmin])
        assert.equal(
          (
            await send(
              actor,
              { type: "STAFF_PROJECT", employeeIds: [employee.id] },
              current.version,
            )
          ).status,
          403,
        )
      for (const id of [inactiveEmployee.id, foreignEmployee.id])
        assert.equal(
          (
            await send(
              head,
              { type: "STAFF_PROJECT", employeeIds: [id] },
              current.version,
            )
          ).status,
          409,
        )
      const newStaff = await user("WorkflowNewContributor", "STAFF")
      const newEmployee = await prisma!.employee.create({
        data: {
          employeeId: "WF-NEW-CONTRIBUTOR",
          fullName: "New Contributor",
          departmentId: department.id,
          userId: newStaff.id,
        },
      })
      const updated = await act(head, {
        type: "STAFF_PROJECT",
        employeeIds: [newEmployee.id],
      })
      assert.equal(updated.state, "ACTIVE_PROJECT")
      assert.equal(updated.project!.id, state.projectId)
      assert.equal(
        await prisma!.project.count({ where: { requestId: request.id } }),
        1,
      )
      assert.equal(
        await prisma!.projectStaff.count({
          where: { projectId: state.projectId },
        }),
        1,
      )
      assert.equal(
        await prisma!.projectMilestone.count({
          where: { projectId: state.projectId },
        }),
        2,
      )
      assert.equal(
        (
          await fetch(`${base}/projects/${state.projectId}`, {
            headers: staff.headers,
          })
        ).status,
        404,
      )
      assert.equal(
        (
          await fetch(`${base}/projects/${state.projectId}`, {
            headers: newStaff.headers,
          })
        ).status,
        200,
      )
      await act(head, { type: "STAFF_PROJECT", employeeIds: [employee.id] })
    },
  )
}
