import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { LeaveContext } from "./context.js"

/** Replayed decisions and cancellations. */
export async function decisionReplays(
  t: TestContext,
  {
    prisma,
    account,
    submit,
    api,
    savedLeave,
    superadmin,
    expectLeaveReadDenied,
    setDepartmentHead,
    action,
    admin,
  }: LeaveContext,
) {
  await t.test("decision replay checks Head and account status", async () => {
    const team = await prisma.department.create({
      data: { name: "Leave replay team" },
    })
    const subject = await account("replay-subject", "STAFF", team.id)
    const originalHead = await account("replay-head", "STAFF", team.id)
    const replacementHead = await account("replacement", "STAFF", team.id)
    const setHead = (headId: string) =>
      prisma.department.update({ where: { id: team.id }, data: { headId } })
    await setHead(originalHead.user.id)

    const { request } = await submit("2027-01-06", "2027-01-06", subject)
    const path = `/leave/requests/${request.id}`
    const verification = {
      actionId: randomUUID(),
      expectedVersion: 1,
      note: "Verified before the Head handoff",
    }
    const verify = () =>
      api(originalHead, `${path}/verify`, { body: verification })
    const verified = await verify()
    assert.equal(verified.status, 200)
    const beforeRetry = await savedLeave(request.id)
    const exactRetry = await verify()
    assert.equal(exactRetry.status, 200)
    assert.deepEqual(await exactRetry.json(), await verified.json())
    assert.deepEqual(await savedLeave(request.id), beforeRetry)

    await setHead(replacementHead.user.id)
    const approval = {
      actionId: randomUUID(),
      expectedVersion: 2,
      note: "Approved after the Head handoff",
    }
    const approve = () => api(superadmin, `${path}/approve`, { body: approval })
    const approved = await approve()
    assert.equal(approved.status, 200)
    const beforeDenials = await savedLeave(request.id)
    assert.equal((await api(replacementHead, path)).status, 200)
    await expectLeaveReadDenied(await api(originalHead, path))
    await expectLeaveReadDenied(await verify())

    await prisma.user.update({
      where: { id: originalHead.user.id },
      data: { isActive: false },
    })
    const revoked = await verify()
    assert.equal(revoked.status, 401)
    assert.deepEqual(await revoked.json(), {
      error: "Invalid or expired session",
    })
    const approvedRetry = await approve()
    assert.equal(approvedRetry.status, 200)
    assert.deepEqual(await approvedRetry.json(), await approved.json())
    assert.deepEqual(await savedLeave(request.id), beforeDenials)
  })

  await t.test(
    "decision replay matches the original canonical payload",
    async () => {
      const team = await prisma.department.create({
        data: { name: "Leave decision payload team" },
      })
      const subject = await account("payload-subject", "STAFF", team.id)
      const reviewer = await account("payload-head", "STAFF", team.id)
      await setDepartmentHead(team.id, reviewer.user.id)
      const { request } = await submit("2027-03-08", "2027-03-08", subject)
      const path = `/leave/requests/${request.id}`
      const body = {
        actionId: randomUUID(),
        expectedVersion: request.version,
        note: "  Original verification note \n",
      }
      const verified = await api(reviewer, `${path}/verify`, { body })
      assert.equal(verified.status, 200, await verified.clone().text())
      const verifiedResult: unknown = await verified.json()
      const before = await savedLeave(request.id)
      const receipt = before.decisions.find(
        ({ actionId }) => actionId === body.actionId,
      )
      assert.ok(receipt)
      assert.equal(receipt.note, "Original verification note")
      assert.equal(receipt.version, body.expectedVersion + 1)

      async function audit() {
        const response = await api(
          superadmin,
          `/workforce-compliance-logs?source=leave&subjectId=${request.id}`,
        )
        assert.equal(response.status, 200, await response.clone().text())
        const { total, events } = (await response.json()) as {
          total: number
          events: unknown[]
        }
        return { total, events }
      }
      const auditBefore = await audit()
      assert.equal(auditBefore.total, 2)

      for (const note of [body.note, "Original verification note"]) {
        const retry = await api(reviewer, `${path}/verify`, {
          body: { ...body, note },
        })
        assert.equal(retry.status, 200)
        assert.deepEqual(await retry.json(), verifiedResult)
      }

      const reused = []
      for (const [endpoint, retryBody] of [
        ["verify", { ...body, note: "Different verification note" }],
        ["verify", { ...body, expectedVersion: 99 }],
        ["reject", body],
      ] as const) {
        const response = await api(reviewer, `${path}/${endpoint}`, {
          body: retryBody,
        })
        const { error } = (await response.json()) as { error?: string }
        reused.push({ status: response.status, error })
      }
      assert.deepEqual(reused, [
        { status: 409, error: "Action ID has already been used" },
        { status: 409, error: "Action ID has already been used" },
        { status: 409, error: "Action ID has already been used" },
      ])
      assert.deepEqual(await savedLeave(request.id), before)
      assert.deepEqual(await audit(), auditBefore)

      const approved = await action(
        admin,
        request.id,
        "approve",
        receipt.version,
      )
      assert.equal(approved.status, 200, await approved.text())
      const afterApproval = await savedLeave(request.id)
      const approvalAudit = await audit()
      assert.equal(approvalAudit.total, 3)
      const detail = await api(reviewer, path)
      assert.equal(detail.status, 200)
      const retry = await api(reviewer, `${path}/verify`, { body })
      assert.equal(retry.status, 200)
      assert.deepEqual(await retry.json(), await detail.json())
      assert.deepEqual(await savedLeave(request.id), afterApproval)
      assert.deepEqual(await audit(), approvalAudit)
    },
  )

  await t.test(
    "replaying a cancellation preserves an omitted note",
    async () => {
      const subject = await account("optional-note-subject", "STAFF")
      const { request } = await submit("2027-03-09", "2027-03-09", subject)
      const path = `/leave/requests/${request.id}/cancel`
      const body = {
        actionId: randomUUID(),
        expectedVersion: request.version,
      }
      const cancelled = await api(subject, path, { body })
      assert.equal(cancelled.status, 200, await cancelled.clone().text())
      const before = await savedLeave(request.id)
      assert.equal(
        before.decisions.find(({ action }) => action === "CANCELLED")?.note,
        null,
      )

      const retry = await api(subject, path, { body })
      assert.equal(retry.status, 200)
      assert.deepEqual(await retry.json(), await cancelled.json())
      const changed = await api(subject, path, {
        body: { ...body, note: "Added a cancellation note" },
      })
      assert.equal(changed.status, 409)
      assert.deepEqual(await changed.json(), {
        error: "Action ID has already been used",
      })
      const explicitNull = await api(subject, path, {
        body: { ...body, note: null },
      })
      assert.equal(explicitNull.status, 400)
      assert.deepEqual(await explicitNull.json(), {
        error: "Provide a valid cancellation note",
      })
      assert.deepEqual(await savedLeave(request.id), before)
    },
  )
}
