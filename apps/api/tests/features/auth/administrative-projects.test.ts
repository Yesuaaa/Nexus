import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"
import type { AdministrativeProject } from "../../../src/features/projects/administrative-projects.js"

test(
  "global project inspection is scoped to administrative read and never operational membership",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function account(role: Role, suffix: string) {
      const user = await prisma.user.create({
        data: {
          role,
          email: `${suffix}@inspection.test`,
          passwordHash: "PRIVATE-CREDENTIAL",
        },
      })
      return {
        user,
        headers: {
          Authorization: `Bearer ${(await issueSession(user)).token}`,
        },
      }
    }
    const sa = await account(Role.SUPERADMIN, "superadmin")
    const admin = await account(Role.ADMIN, "admin")
    const staff = await account(Role.STAFF, "staff")
    const client = await account(Role.USER, "client")
    const other = await account(Role.USER, "other")
    const service = await prisma.service.create({
      data: { name: "Inspection service", description: "Test" },
    })
    const ids: string[] = []
    const departments: string[] = []
    for (let index = 0; index < 2; index++) {
      const department = await prisma.department.create({
        data: { name: `Department ${index}` },
      })
      departments.push(department.id)
      const request = await prisma.serviceRequest.create({
        data: {
          clientId: index ? other.user.id : client.user.id,
          serviceId: service.id,
          title: `Request ${index}`,
          packageName: "Standard",
          pricingModel: "FIXED",
          acceptedDepartmentId: department.id,
        },
      })
      const project = await prisma.project.create({
        data: {
          name: `Project ${index}`,
          clientId: index ? other.user.id : client.user.id,
          requestId: request.id,
          status: index ? "ON_HOLD" : "IN_PROGRESS",
          startDate: new Date(),
          workPlan: {
            private: "PRIVATE-PLAN",
            phases: [
              {
                id: "phase",
                title: "Build",
                tasks: [
                  {
                    id: "task",
                    title: "Implement",
                    role: "Developer",
                    status: "NOT_STARTED",
                    private: "PRIVATE-TASK",
                  },
                ],
              },
            ],
          },
        },
      })
      ids.push(project.id)
      await prisma.projectMilestone.create({
        data: { projectId: project.id, title: `Milestone ${index}` },
      })
      await prisma.projectMessage.create({
        data: {
          projectId: project.id,
          senderId: staff.user.id,
          body: "PRIVATE-CONVERSATION",
          clientMessageId: `message-${index}`,
        },
      })
    }
    const get = (path: string, actor = sa) =>
      fetch(`${base}${path}`, { headers: actor.headers })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "inspection-staff",
        fullName: "Assigned Staff",
        userId: staff.user.id,
        departmentId: departments[0],
      },
    })
    await prisma.projectStaff.create({
      data: {
        projectId: ids[0],
        employeeId: employee.id,
        approvedById: staff.user.id,
      },
    })
    assert.equal((await fetch(`${base}/administrative-projects`)).status, 401)
    const list = await get("/administrative-projects")
    assert.equal(list.status, 200)
    const body = await list.text()
    assert.ok(!body.includes("PRIVATE-"))
    const payload = JSON.parse(body)
    assert.equal(payload.total, 2)
    for (const id of ids) {
      const response = await get(`/administrative-projects/${id}`)
      assert.equal(response.status, 200)
      const { project } = (await response.json()) as {
        project: AdministrativeProject
      }
      assert.equal(project.canManage, false)
      assert.equal(project.workstreams[0].canAssign, false)
      assert.equal(
        project.workstreams[0].plan?.phases[0].tasks[0].title,
        "Implement",
      )
      assert.equal(project.workstreams[0].milestones.length, 1)
      assert.deepEqual(project.capabilities, {
        read: true,
        manage: false,
        rename: false,
        approve: false,
        release: false,
        participate: false,
        downloadFiles: false,
      })
      for (const method of ["POST", "PATCH", "DELETE"])
        assert.equal(
          (
            await fetch(`${base}/administrative-projects/${id}`, {
              method,
              headers: sa.headers,
            })
          ).status,
          404,
        )
      assert.equal((await get(`/projects/${id}`)).status, 404)
      assert.equal((await get(`/project-workspace/${id}`)).status, 403)
    }
    for (const query of [
      `departmentId=${departments[1]}`,
      "status=IN_PROGRESS",
      "search=Project%200",
    ])
      assert.equal(
        (
          (await (await get(`/administrative-projects?${query}`)).json()) as {
            total: number
          }
        ).total,
        1,
      )
    assert.equal((await get("/administrative-projects?page=0")).status, 400)
    assert.equal((await get("/administrative-projects/missing")).status, 404)
    for (const actor of [admin, staff, client]) {
      assert.equal((await get("/administrative-projects", actor)).status, 403)
      assert.equal(
        (await get(`/administrative-projects/${ids[0]}`, actor)).status,
        403,
      )
    }
    assert.equal((await get(`/projects/${ids[0]}`, client)).status, 200)
    assert.equal((await get(`/projects/${ids[1]}`, client)).status, 404)
    assert.equal((await get(`/projects/${ids[0]}`, staff)).status, 200)
    assert.equal((await get(`/projects/${ids[1]}`, staff)).status, 404)
    assert.equal(
      await prisma.employee.count({ where: { userId: sa.user.id } }),
      0,
    )
    assert.equal(await prisma.projectStaff.count(), 1)
    assert.equal(
      await prisma.projectStaff.count({
        where: { employee: { userId: sa.user.id } },
      }),
      0,
    )
    const group = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Shared workspace",
        structure: "SEPARATE",
        clientId: client.user.id,
        createdById: staff.user.id,
      },
    })
    await prisma.project.update({
      where: { id: ids[0] },
      data: { workspaceGroupId: group.id },
    })
    const grouped = (await (
      await get(`/administrative-projects/${ids[0]}`)
    ).json()) as { project: AdministrativeProject }
    assert.equal(grouped.project.workspaceGroup?.name, "Shared workspace")
    const standalone = await prisma.project.create({
      data: { name: "Standalone planned project", clientId: other.user.id },
    })
    assert.equal(
      (await get(`/administrative-projects/${standalone.id}`)).status,
      200,
    )
    assert.equal(
      (
        (await (
          await get("/administrative-projects?status=PLANNED")
        ).json()) as { total: number }
      ).total,
      1,
    )
    await prisma.user.update({
      where: { id: sa.user.id },
      data: { role: Role.ADMIN },
    })
    assert.equal((await get("/administrative-projects")).status, 403)
  },
)
