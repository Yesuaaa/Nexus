import assert from "node:assert/strict"
import type { TestContext } from "node:test"
import type { LeaveContext } from "./context.js"

/** Approval follows the requester's employee and account status. */
export async function requesterAccount(
  t: TestContext,
  {
    account,
    submit,
    action,
    head,
    prisma,
    savedLeave,
    admin,
    superadmin,
    verifiedLeave,
    setRequesterActive,
    api,
    expectRequesterConflict,
  }: LeaveContext,
) {
  await t.test(
    "leave approval rechecks the employee's current status",
    async () => {
      const subject = await account("inactive-after-submitting", "STAFF")
      const { request } = await submit("2026-12-11", "2026-12-11", subject)
      const verification = await action(
        head,
        request.id,
        "verify",
        request.version,
      )
      assert.equal(verification.status, 200, await verification.text())

      await prisma.employee.update({
        where: { id: subject.employee.id },
        data: { status: "INACTIVE" },
      })
      const before = await savedLeave(request.id)
      for (const reviewer of [admin, superadmin]) {
        const approval = await action(reviewer, request.id, "approve", 2)
        assert.equal(approval.status, 409, await approval.clone().text())
        assert.match(await approval.text(), /employee is inactive/i)
      }
      const pendingRequest = await prisma.leaveRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true, version: true },
      })
      assert.deepEqual(pendingRequest, { status: "VERIFIED", version: 2 })
      assert.deepEqual(await savedLeave(request.id), before)

      const rejection = await action(admin, request.id, "reject", 2)
      assert.equal(rejection.status, 200, await rejection.clone().text())
      const rejected = (await rejection.json()) as {
        request: { status: string }
      }
      assert.equal(rejected.request.status, "REJECTED")
    },
  )

  await t.test(
    "leave approval follows the requester account lifecycle",
    async () => {
      const subject = await account("leave-lifecycle", "STAFF")
      const requestId = await verifiedLeave(subject)
      const disabled = await setRequesterActive(subject, false)
      assert.equal(disabled.status, 200, await disabled.text())
      assert.equal((await api(subject, "/auth/me")).status, 401)
      const employment = await prisma.employee.findUniqueOrThrow({
        where: { id: subject.employee.id },
        select: { status: true, userId: true },
      })
      assert.deepEqual(employment, {
        status: "ACTIVE",
        userId: subject.user.id,
      })
      await expectRequesterConflict(requestId)

      const archived = await api(superadmin, `/users/${subject.user.id}`, {
        method: "DELETE",
      })
      assert.equal(archived.status, 200, await archived.text())
      await expectRequesterConflict(requestId)

      const restored = await api(
        superadmin,
        `/users/${subject.user.id}/restore`,
        {
          method: "POST",
        },
      )
      assert.equal(restored.status, 200, await restored.text())
      await expectRequesterConflict(requestId)

      const reactivated = await setRequesterActive(subject, true)
      assert.equal(reactivated.status, 200, await reactivated.text())
      const approved = await action(admin, requestId, "approve", 2)
      assert.equal(approved.status, 200, await approved.text())
      const committed = await savedLeave(requestId)
      assert.equal(committed.status, "APPROVED")
      assert.equal(committed.version, 3)
      assert.equal(
        committed.decisions.filter(({ action }) => action === "APPROVED")
          .length,
        1,
      )
      assert.equal(
        committed.notifications.filter(({ type }) => type === "LEAVE_APPROVED")
          .length,
        1,
      )

      const disabledAfterApproval = await setRequesterActive(subject, false)
      assert.equal(
        disabledAfterApproval.status,
        200,
        await disabledAfterApproval.text(),
      )
      assert.deepEqual(await savedLeave(requestId), committed)
    },
  )

  await t.test(
    "leave approval requires the original eligible login",
    async () => {
      const subject = await account("leave-unlinked", "STAFF")
      const requestId = await verifiedLeave(subject)
      const setLinkedUser = (userId: string | null) =>
        prisma.employee.update({
          where: { id: subject.employee.id },
          data: { userId },
        })

      await setLinkedUser(null)
      await expectRequesterConflict(requestId)
      const replacement = await prisma.user.create({
        data: {
          fullName: "Replacement login",
          email: "leave-replacement-login@leave.test",
          passwordHash: "test-only",
          role: "STAFF",
        },
      })
      await setLinkedUser(replacement.id)
      await expectRequesterConflict(requestId)
      await setLinkedUser(subject.user.id)
      await prisma.user.update({
        where: { id: subject.user.id },
        data: { role: "USER" },
      })
      await expectRequesterConflict(requestId)

      const rejected = await action(admin, requestId, "reject", 2)
      assert.equal(rejected.status, 200, await rejected.text())
      assert.equal((await savedLeave(requestId)).status, "REJECTED")
    },
  )

  await t.test(
    "leave approval accepts an eligible Admin on leave",
    async () => {
      const subject = await account("leave-admin-requester", "ADMIN")
      const requestId = await verifiedLeave(subject)
      await prisma.employee.update({
        where: { id: subject.employee.id },
        data: { status: "ON_LEAVE" },
      })
      const approved = await action(superadmin, requestId, "approve", 2)
      assert.equal(approved.status, 200, await approved.text())
      assert.equal((await savedLeave(requestId)).status, "APPROVED")
    },
  )

  await t.test(
    "leave approval serializes with a concurrent account disable",
    async (race) => {
      const subject = await account("leave-approval-race", "STAFF")
      const requestId = await verifiedLeave(subject)
      const before = await savedLeave(requestId)
      const [disabled, approved] = await Promise.all([
        setRequesterActive(subject, false),
        action(admin, requestId, "approve", 2),
      ])
      assert.equal(disabled.status, 200, await disabled.text())
      assert.equal((await api(subject, "/auth/me")).status, 401)

      const after = await savedLeave(requestId)
      if (approved.status === 409) {
        assert.match(
          await approved.text(),
          /active linked Staff or Admin account/,
        )
        assert.deepEqual(after, before)
        race.diagnostic("Account disable took effect before approval")
      } else {
        assert.equal(approved.status, 200, await approved.text())
        assert.equal(after.status, "APPROVED")
        assert.equal(after.version, 3)
        const decision = after.decisions.find(
          ({ action }) => action === "APPROVED",
        )
        assert.ok(decision?.writerTransaction)
        // The isolated fixture uses one connection. Confirm which write ran first.
        const [accountWrite] = await prisma.$queryRaw<{ xid: string }[]>`
          SELECT xmin::text AS xid FROM "User" WHERE "id" = ${subject.user.id}
        `
        assert.ok(BigInt(decision.writerTransaction) < BigInt(accountWrite.xid))
        race.diagnostic("Approval committed before account disable")
      }
    },
  )
}
