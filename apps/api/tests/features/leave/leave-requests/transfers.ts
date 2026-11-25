import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { LeaveContext, Account } from "./context.js"

/** Re-verification after a department move, and decision replay. */
export async function departmentTransfers(
  t: TestContext,
  {
    submit,
    api,
    head,
    prisma,
    admin,
    noticePath,
    employee,
    outsideDepartment,
    outsider,
    superadmin,
    action,
    savedLeave,
    expectLeaveReadDenied,
  }: LeaveContext,
) {
  // A department move requires the receiving Head to verify again.
  const transferred = await submit("2026-11-24", "2026-11-24")
  const transferredPath = `/leave/requests/${transferred.request.id}`
  const originalVerification = {
    actionId: randomUUID(),
    expectedVersion: 1,
    note: "Confirmed by the original Department Head",
  }
  assert.equal(
    (
      await api(head, `${transferredPath}/verify`, {
        body: originalVerification,
      })
    ).status,
    200,
  )
  const originalNotice = await prisma.workflowNotification.findFirstOrThrow({
    where: {
      userId: admin.user.id,
      leaveRequestId: transferred.request.id,
      type: "LEAVE_VERIFIED",
    },
  })
  assert.equal(
    (
      await api(admin, `${noticePath}/${originalNotice.id}/read`, {
        method: "PATCH",
      })
    ).status,
    200,
  )

  await prisma.employee.update({
    where: { id: employee.employee.id },
    data: { departmentId: outsideDepartment.id },
  })
  async function transferCapabilities(reviewer: Account) {
    const list = await api(
      reviewer,
      "/leave/requests?scope=team&status=VERIFIED",
    )
    assert.equal(list.status, 200, await list.clone().text())
    const { requests } = (await list.json()) as {
      requests: {
        id: string
        capabilities: {
          approve: boolean
          verify: boolean
          fallback: boolean
          requiresReverification: boolean
        }
      }[]
    }
    const request = requests.find(({ id }) => id === transferred.request.id)
    assert.ok(request)
    return request.capabilities
  }
  const fallbackAccess = await transferCapabilities(admin)
  assert.equal(fallbackAccess.approve, false)
  assert.equal(fallbackAccess.requiresReverification, true)
  assert.equal(fallbackAccess.fallback, true)

  await prisma.department.update({
    where: { id: outsideDepartment.id },
    data: { headId: outsider.user.id },
  })
  for (const reviewer of [admin, superadmin]) {
    const access = await transferCapabilities(reviewer)
    assert.equal(access.approve, false)
    assert.equal(access.requiresReverification, true)
    assert.equal(
      (await action(reviewer, transferred.request.id, "approve", 2)).status,
      409,
    )
  }
  assert.equal((await transferCapabilities(outsider)).verify, true)
  assert.equal(
    (await action(head, transferred.request.id, "verify", 2)).status,
    403,
  )
  const reverification = {
    actionId: randomUUID(),
    expectedVersion: 2,
    note: "Confirmed by the receiving Department Head",
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const verifiedAgain = await api(
      outsider,
      `/leave/requests/${transferred.request.id}/verify`,
      { body: reverification },
    )
    assert.equal(verifiedAgain.status, 200, await verifiedAgain.text())
  }
  const restoredAccess = await transferCapabilities(admin)
  assert.equal(restoredAccess.approve, true)
  assert.equal(restoredAccess.requiresReverification, false)

  // A delayed read of the original notice must leave the new one unread.
  assert.equal(
    (
      await api(admin, `${noticePath}/${originalNotice.id}/read`, {
        method: "PATCH",
      })
    ).status,
    200,
  )
  const notices = await api(admin, noticePath)
  assert.equal(notices.status, 200, await notices.clone().text())
  const { notifications } = (await notices.json()) as {
    notifications: {
      id: string
      type: string
      leaveRequestId: string
      readAt: string | null
    }[]
  }
  const verifications = notifications.filter(
    ({ leaveRequestId, type }) =>
      leaveRequestId === transferred.request.id && type === "LEAVE_VERIFIED",
  )
  assert.equal(verifications.length, 2)
  assert.equal(
    verifications.filter(
      ({ id, readAt }) => id !== originalNotice.id && readAt === null,
    ).length,
    1,
  )
  assert.ok(verifications.find(({ id }) => id === originalNotice.id)?.readAt)
  assert.equal(
    (await action(admin, transferred.request.id, "approve", 3)).status,
    200,
  )
  await t.test("decision replay checks department scope", async () => {
    const before = await savedLeave(transferred.request.id)
    await expectLeaveReadDenied(await api(head, transferredPath))
    await expectLeaveReadDenied(
      await api(head, `${transferredPath}/verify`, {
        body: originalVerification,
      }),
    )
    await expectLeaveReadDenied(
      await api(head, `${transferredPath}/verify`, {
        body: { ...originalVerification, note: "Changed after transfer" },
      }),
    )

    const detail = await api(outsider, transferredPath)
    assert.equal(detail.status, 200)
    const retry = await api(outsider, `${transferredPath}/verify`, {
      body: reverification,
    })
    assert.equal(retry.status, 200)
    assert.deepEqual(await retry.json(), await detail.json())
    assert.deepEqual(await savedLeave(transferred.request.id), before)
  })
  assert.equal(
    (await api(employee, `/leave/requests/${transferred.request.id}`)).status,
    200,
  )

  return { transferred }
}
