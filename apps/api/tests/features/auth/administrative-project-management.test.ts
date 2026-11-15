import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "administrative workspace rename preserves eligibility, lifecycle, actor history and ordinary-role restrictions",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(role: Role, label: string) {
      const user = await prisma.user.create({
        data: {
          email: `${label}@rename.test`,
          role,
          passwordHash: "test-only",
        },
      })
      return {
        user,
        headers: {
          Authorization: `Bearer ${(await issueSession(user)).token}`,
          "content-type": "application/json",
        },
      }
    }
    const sa = await actor(Role.SUPERADMIN, "sa")
    const admin = await actor(Role.ADMIN, "admin")
    const staff = await actor(Role.STAFF, "staff")
    const client = await actor(Role.USER, "client")
    const service = await prisma.service.create({
      data: { name: "Rename service", description: "Test" },
    })
    const projects = []
    for (let index = 0; index < 2; index++) {
      const department = await prisma.department.create({
        data: {
          name: `Rename department ${index}`,
          ...(index === 0 ? { headId: staff.user.id } : {}),
        },
      })
      const request = await prisma.serviceRequest.create({
        data: {
          title: "Rename request",
          clientId: client.user.id,
          serviceId: service.id,
          acceptedDepartmentId: department.id,
        },
      })
      projects.push(
        // Real request-backed projects already have their workflow event parent.
        await prisma.project.create({
          data: {
            name: `Original ${index}`,
            clientId: client.user.id,
            requestId: request.id,
            status: "IN_PROGRESS",
          },
        }),
      )
      await prisma.requestWorkflow.create({ data: { requestId: request.id } })
    }
    const rename = (id: string, name: string, account = sa) =>
      fetch(`${base}/administrative-projects/${id}/workspace-name`, {
        method: "PATCH",
        headers: account.headers,
        body: JSON.stringify({ name }),
      })
    for (const project of projects) {
      const renamed = await rename(project.id, "  Administrative name  ")
      assert.equal(renamed.status, 200, await renamed.text())
      assert.equal(
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
          .name,
        "Administrative name",
      )
      const event = await prisma.workflowEvent.findFirstOrThrow({
        where: { requestId: project.requestId!, type: "WORKSPACE_RENAMED" },
      })
      assert.equal(event.actorId, sa.user.id)
      assert.equal(event.entityId, project.id)
      assert.equal(event.internal, true)
      assert.equal((await rename(project.id, "x")).status, 400)
      for (const account of [admin, staff, client])
        assert.equal(
          (await rename(project.id, "Unauthorized", account)).status,
          403,
        )
    }
    const staffRename = await fetch(
      `${base}/project-workspace/${projects[0].id}`,
      {
        method: "PATCH",
        headers: staff.headers,
        body: JSON.stringify({ name: "Administrative name" }),
      },
    )
    assert.equal(staffRename.status, 200, await staffRename.text())
    assert.equal(
      await prisma.workflowEvent.count({
        where: { actorId: staff.user.id, type: "WORKSPACE_RENAMED" },
      }),
      1,
    )
    assert.equal(
      (
        await fetch(`${base}/project-workspace/${projects[1].id}`, {
          method: "PATCH",
          headers: staff.headers,
          body: JSON.stringify({ name: "Other department" }),
        })
      ).status,
      404,
    )
    const group = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Group",
        structure: "MULTI_WORKSTREAM",
        clientId: client.user.id,
        createdById: staff.user.id,
      },
    })
    await prisma.project.updateMany({
      where: { id: { in: projects.map((project) => project.id) } },
      data: { workspaceGroupId: group.id },
    })
    assert.equal(
      (await rename(projects[0].id, "Cross-department group")).status,
      200,
    )
    assert.equal(
      (
        await prisma.projectWorkspaceGroup.findUniqueOrThrow({
          where: { id: group.id },
        })
      ).name,
      "Cross-department group",
    )
    assert.equal(
      await prisma.workflowEvent.count({
        where: { actorId: sa.user.id, type: "WORKSPACE_RENAMED" },
      }),
      4,
    )
    assert.equal(
      await prisma.project.count({
        where: { name: "Administrative name", status: "IN_PROGRESS" },
      }),
      2,
    )
    await prisma.project.updateMany({
      where: { workspaceGroupId: group.id },
      data: { status: "COMPLETED" },
    })
    assert.equal((await rename(projects[0].id, "Archived edit")).status, 409)
    assert.equal(
      await prisma.workflowEvent.count({
        where: { actorId: sa.user.id, type: "WORKSPACE_RENAMED" },
      }),
      4,
    )
    const standalone = await prisma.project.create({
      data: { name: "Standalone", clientId: client.user.id },
    })
    assert.equal((await rename(standalone.id, "No history")).status, 409)
    assert.equal((await rename("missing", "Missing project")).status, 404)
    for (const path of [
      `/project-workspace/${projects[0].id}/status`,
      `/project-workspace/${projects[0].id}/cancel`,
      `/request-workflows/${projects[0].requestId}/actions`,
    ]) {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: sa.headers,
        body: JSON.stringify({
          action: "COMPLETE",
          type: "ACTIVATE_PROJECT",
          actionId: randomUUID(),
          expectedVersion: 1,
        }),
      })
      assert.ok(
        [403, 404].includes(response.status),
        `${path}: ${response.status}`,
      )
    }
    assert.equal(await prisma.projectStaff.count(), 0)
    assert.equal(
      await prisma.employee.count({ where: { userId: sa.user.id } }),
      0,
    )
    assert.equal(
      await prisma.department.count({ where: { headId: sa.user.id } }),
      0,
    )
    await prisma.user.update({
      where: { id: sa.user.id },
      data: { role: Role.ADMIN },
    })
    assert.equal((await rename(projects[0].id, "Revoked")).status, 403)
  },
)
