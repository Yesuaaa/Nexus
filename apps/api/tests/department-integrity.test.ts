import assert from "node:assert/strict"
import { test } from "node:test"
import express from "express"
import { Prisma } from "../src/generated/prisma/client.js"
import { issueSession } from "../src/features/auth/auth.service.js"
import { handleError } from "../src/shared/error-handler.js"
import { closeServer, listen, startPgliteApp } from "./support/pglite-app.js"

test(
  "department and employee writes keep head, lead, and history integrity",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)

    const admin = await prisma.user.create({
      data: {
        id: "admin",
        email: "admin@integrity.example",
        fullName: "Admin Person",
        passwordHash: "test-only-hash",
        role: "ADMIN",
      },
    })
    const token = (await issueSession(admin)).token

    await prisma.department.create({
      data: { id: "dept-a", name: "Product", code: "PROD" },
    })
    await prisma.team.create({
      data: { id: "team-a", name: "Design", departmentId: "dept-a" },
    })
    async function staff(
      id: string,
      position: string | null,
      startDate: string,
      teamId: string | null = null,
    ) {
      await prisma.user.create({
        data: {
          id,
          email: `${id}@integrity.example`,
          fullName: `${id} Person`,
          passwordHash: "test-only-hash",
          role: "STAFF",
          position,
          departmentId: "dept-a",
          teamId,
          employee: {
            create: {
              id: `emp-${id}`,
              employeeId: `EXP-${id}`,
              fullName: `${id} Person`,
              position,
              startDate: new Date(startDate),
              departmentId: "dept-a",
              teamId,
            },
          },
        },
      })
    }
    await staff("head", "Department Head", "2020-01-01")
    await staff("deputy", "Designer", "2021-01-01")
    await staff("stale", "Department Head", "2022-01-01")
    await staff("lead", "Team Lead", "2022-06-01", "team-a")
    await prisma.department.update({
      where: { id: "dept-a" },
      data: { headId: "head" },
    })
    await prisma.team.update({
      where: { id: "team-a" },
      data: { leadId: "lead" },
    })

    const base = `${origin}/api`
    async function request(path: string, method = "GET", body?: unknown) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = (await response.json()) as { error?: string }
      return { status: response.status, payload }
    }

    await t.test(
      "loading department detail keeps an on-leave head's title",
      async () => {
        const leave = await request("/employees/emp-head", "PUT", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "emp-deputy",
        })
        assert.equal(leave.status, 200, JSON.stringify(leave.payload))
        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "dept-a" },
        })
        assert.equal(department.headId, "deputy")
        assert.equal(department.temporaryHeadOriginalId, "head")
        assert.equal(department.temporaryHeadAssignedId, "deputy")

        const detail = await request("/departments/dept-a")
        assert.equal(detail.status, 200, JSON.stringify(detail.payload))

        const head = await prisma.user.findUniqueOrThrow({
          where: { id: "head" },
          include: { employee: true },
        })
        assert.equal(head.position, "Department Head")
        assert.equal(head.employee?.position, "Department Head")
        // Stale titles on everyone else are still cleaned up.
        const stale = await prisma.user.findUniqueOrThrow({
          where: { id: "stale" },
          include: { employee: true },
        })
        assert.equal(stale.position, null)
        assert.equal(stale.employee?.position, null)
      },
    )

    await t.test(
      "restoring an on-leave head onto a sub-team is rejected",
      async () => {
        const rejected = await request("/employees/emp-head", "PUT", {
          status: "ACTIVE",
          teamId: "team-a",
        })
        assert.equal(rejected.status, 400, JSON.stringify(rejected.payload))
        assert.match(rejected.payload.error ?? "", /cannot be assigned/)

        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "dept-a" },
        })
        assert.equal(department.headId, "deputy")
        assert.equal(department.temporaryHeadOriginalId, "head")
        assert.equal(department.temporaryHeadAssignedId, "deputy")
        const head = await prisma.user.findUniqueOrThrow({
          where: { id: "head" },
          include: { employee: true },
        })
        assert.equal(head.teamId, null)
        assert.equal(head.employee?.teamId, null)
        assert.equal(head.employee?.status, "ON_LEAVE")

        // Returning without a team restores the original head.
        const restored = await request("/employees/emp-head", "PUT", {
          status: "ACTIVE",
          position: "Department Head",
        })
        assert.equal(restored.status, 200, JSON.stringify(restored.payload))
        const after = await prisma.department.findUniqueOrThrow({
          where: { id: "dept-a" },
        })
        assert.equal(after.headId, "head")
        assert.equal(after.temporaryHeadOriginalId, null)
        assert.equal(after.temporaryHeadAssignedId, null)
      },
    )

    await t.test(
      "department name and code uniqueness reject conflicting writes without persistence",
      async () => {
        const created = await request("/departments", "POST", {
          name: "Sales",
          code: "SALES",
        })
        assert.equal(created.status, 201, JSON.stringify(created.payload))
        const createdDepartment = created.payload as typeof created.payload & {
          department?: { id: string; code: string | null }
        }
        const departmentId = createdDepartment.department?.id
        assert.ok(departmentId)
        assert.equal(createdDepartment.department?.code, "SALES")

        const duplicateName = await request("/departments", "POST", {
          name: " Product ",
          code: "OTHER",
        })
        assert.equal(duplicateName.status, 409)
        assert.equal(
          await prisma.department.count({ where: { code: "OTHER" } }),
          0,
        )

        const duplicateCode = await request("/departments", "POST", {
          name: "Support",
          code: " prod ",
        })
        assert.equal(duplicateCode.status, 409)
        assert.equal(
          await prisma.department.count({ where: { name: "Support" } }),
          0,
        )

        const updateDuplicateCode = await request(
          `/departments/${departmentId}`,
          "PUT",
          { code: " prod " },
        )
        assert.equal(updateDuplicateCode.status, 409)
        const persisted = await prisma.department.findUniqueOrThrow({
          where: { id: departmentId },
        })
        assert.equal(persisted.name, "Sales")
        assert.equal(persisted.code, "SALES")
      },
    )

    await t.test(
      "department API enforces name and code length boundaries and normalizes fields",
      async () => {
        const belowMinimumName = await request("/departments", "POST", {
          name: "A",
        })
        assert.equal(belowMinimumName.status, 400)

        const minimum = await request("/departments", "POST", {
          name: "  HR  ",
          code: " it ",
          description: "  People operations  ",
        })
        assert.equal(minimum.status, 201, JSON.stringify(minimum.payload))
        const minimumDepartment = minimum.payload as typeof minimum.payload & {
          department?: { id: string; name: string; code: string | null }
        }
        assert.equal(minimumDepartment.department?.name, "HR")
        assert.equal(minimumDepartment.department?.code, "IT")
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: minimumDepartment.department!.id },
            })
          ).description,
          "People operations",
        )

        const maximum = await request("/departments", "POST", {
          name: "N".repeat(80),
          code: "C".repeat(20),
        })
        assert.equal(maximum.status, 201, JSON.stringify(maximum.payload))

        const aboveMaximumName = await request("/departments", "POST", {
          name: "N".repeat(81),
        })
        assert.equal(aboveMaximumName.status, 400)
        const belowMinimumCode = await request("/departments", "POST", {
          name: "Short code",
          code: "C",
        })
        assert.equal(belowMinimumCode.status, 400)
        const aboveMaximumCode = await request("/departments", "POST", {
          name: "Long code",
          code: "C".repeat(21),
        })
        assert.equal(aboveMaximumCode.status, 400)

        const emptyOptionalFields = await request("/departments", "POST", {
          name: "No code",
          code: "   ",
          description: "   ",
        })
        assert.equal(
          emptyOptionalFields.status,
          201,
          JSON.stringify(emptyOptionalFields.payload),
        )
        const noCode = await prisma.department.findUniqueOrThrow({
          where: { name: "No code" },
        })
        assert.equal(noCode.code, null)
        assert.equal(noCode.description, null)
      },
    )

    await t.test(
      "team lead reassignment updates the lead and synchronizes employee placement",
      async () => {
        const assignDeputy = await request(
          "/departments/dept-a/teams/team-a",
          "PUT",
          { leadId: "deputy" },
        )
        assert.equal(
          assignDeputy.status,
          200,
          JSON.stringify(assignDeputy.payload),
        )
        const reassigned = await prisma.team.findUniqueOrThrow({
          where: { id: "team-a" },
        })
        assert.equal(reassigned.leadId, "deputy")
        const deputy = await prisma.user.findUniqueOrThrow({
          where: { id: "deputy" },
        })
        const deputyEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "deputy" },
        })
        assert.equal(deputy.departmentId, "dept-a")
        assert.equal(deputy.teamId, "team-a")
        assert.equal(deputyEmployee.departmentId, "dept-a")
        assert.equal(deputyEmployee.teamId, "team-a")

        const reassignLead = await request(
          "/departments/dept-a/teams/team-a",
          "PUT",
          { leadId: "lead" },
        )
        assert.equal(
          reassignLead.status,
          200,
          JSON.stringify(reassignLead.payload),
        )
        assert.equal(
          (await prisma.team.findUniqueOrThrow({ where: { id: "team-a" } }))
            .leadId,
          "lead",
        )
        const lead = await prisma.user.findUniqueOrThrow({
          where: { id: "lead" },
        })
        const leadEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "lead" },
        })
        assert.equal(lead.departmentId, "dept-a")
        assert.equal(lead.teamId, "team-a")
        assert.equal(leadEmployee.departmentId, "dept-a")
        assert.equal(leadEmployee.teamId, "team-a")
      },
    )

    await t.test("a Team Lead going inactive steps down as lead", async () => {
      const inactive = await request("/employees/emp-lead", "PUT", {
        status: "INACTIVE",
      })
      assert.equal(inactive.status, 200, JSON.stringify(inactive.payload))
      const team = await prisma.team.findUniqueOrThrow({
        where: { id: "team-a" },
      })
      assert.equal(team.leadId, null)
      const lead = await prisma.employee.findUniqueOrThrow({
        where: { id: "emp-lead" },
      })
      assert.equal(lead.status, "INACTIVE")
      assert.equal(lead.teamId, "team-a")
    })

    await t.test(
      "deleting a department with request history returns 409",
      async () => {
        const client = await prisma.user.create({
          data: {
            email: "client@integrity.example",
            fullName: "Client Person",
            passwordHash: "test-only-hash",
            role: "USER",
          },
        })
        const service = await prisma.service.create({
          data: { name: "Branding", description: "Brand work" },
        })
        await prisma.department.createMany({
          data: [
            { id: "dept-accepted", name: "Accepted Requests" },
            { id: "dept-chat", name: "Conversation Only" },
            { id: "dept-service", name: "Linked Service" },
          ],
        })
        await prisma.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            title: "Accepted request",
            status: "UNDER_REVIEW",
            acceptedDepartmentId: "dept-accepted",
            acceptedAt: new Date(),
          },
        })
        await prisma.requestConversation.create({
          data: { clientId: client.id, departmentId: "dept-chat" },
        })
        await prisma.service.update({
          where: { id: service.id },
          data: { departments: { connect: { id: "dept-service" } } },
        })
        await prisma.requestConversation.create({
          data: { clientId: client.id, departmentId: "dept-service" },
        })

        for (const id of ["dept-accepted", "dept-chat"]) {
          const deleted = await request(`/departments/${id}`, "DELETE")
          assert.equal(deleted.status, 409, id)
          assert.equal(
            deleted.payload.error,
            "This department has client request history and can't be deleted",
          )
          assert.ok(await prisma.department.findUnique({ where: { id } }))
        }
        const linked = await request("/departments/dept-service", "DELETE")
        assert.equal(linked.status, 409)
        assert.equal(
          linked.payload.error,
          "Reassign or remove this department's services before deleting the department",
        )

        await prisma.department.create({
          data: { id: "dept-empty", name: "Empty" },
        })
        const emptyDelete = await request("/departments/dept-empty", "DELETE")
        assert.equal(emptyDelete.status, 200)
        assert.equal(
          await prisma.department.findUnique({ where: { id: "dept-empty" } }),
          null,
        )
      },
    )

    await t.test(
      "the error handler maps foreign key failures to 409",
      async () => {
        const app = express()
        app.get("/fk", () => {
          throw new Prisma.PrismaClientKnownRequestError(
            "Foreign key constraint violated",
            { code: "P2003", clientVersion: "test" },
          )
        })
        app.use(handleError)
        const fk = await listen(app)
        try {
          const response = await fetch(`${fk.origin}/fk`)
          assert.equal(response.status, 409)
          const body = (await response.json()) as { error: string }
          assert.equal(
            body.error,
            "This record is linked to other data and can't be changed or deleted",
          )
        } finally {
          await closeServer(fk.server)
        }
      },
    )
  },
)
