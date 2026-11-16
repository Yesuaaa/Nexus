import assert from "node:assert/strict"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Superadmin manages People and HR across departments without operational identity",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(name: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@people-hr.test`,
          fullName: name,
          passwordHash: "PRIVATE-HASH",
          role,
        },
      })
      return {
        user,
        headers: {
          authorization: `Bearer ${(await issueSession(user)).token}`,
          "content-type": "application/json",
        },
      }
    }
    const sa = await actor("Superadmin", "SUPERADMIN")
    const admin = await actor("Admin", "ADMIN")
    const head = await actor("Head", "STAFF")
    const staff = await actor("Staff", "STAFF")
    const client = await actor("Client", "USER")
    const request = (path: string, method = "GET", body?: unknown, who = sa) =>
      fetch(`${base}${path}`, {
        method,
        headers: who.headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const departments: { id: string }[] = []
    for (const name of ["Design", "Engineering"]) {
      const created = await request("/departments", "POST", {
        name,
        color: "blue",
      })
      assert.equal(created.status, 201, await created.clone().text())
      departments.push(
        ((await created.json()) as { department: { id: string } }).department,
      )
    }
    const employees: { id: string }[] = []
    for (const [index, department] of departments.entries()) {
      const created = await request("/employees", "POST", {
        employeeId: `EXP-HR-${index}`,
        fullName: index ? "Engineering Employee" : "Design Employee",
        email: `employee-${index}@people-hr.test`,
        contactNumber: "09123456789",
        position: "Specialist",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: "2026-01-01",
        departmentId: department.id,
        teamId: null,
        password: "ValidPassword1!",
      })
      assert.equal(created.status, 201, await created.clone().text())
      employees.push(
        ((await created.json()) as { employee: { id: string } }).employee,
      )
    }
    const headEmployee = await prisma.employee.create({
      data: {
        employeeId: "EXP-HEAD",
        fullName: "Head",
        userId: head.user.id,
        departmentId: departments[0].id,
      },
    })
    await prisma.user.update({
      where: { id: head.user.id },
      data: { departmentId: departments[0].id },
    })
    const setHead = await request(`/departments/${departments[0].id}`, "PUT", {
      headId: head.user.id,
    })
    assert.equal(setHead.status, 200, await setHead.clone().text())
    const employeeAccounts = await prisma.employee.findMany({
      where: { id: { in: employees.map((row) => row.id) } },
      select: { id: true, userId: true },
    })
    for (const [index, department] of departments.entries()) {
      const detail = await request(`/departments/${department.id}`)
      assert.equal(detail.status, 200)
      const text = await detail.text()
      assert.ok(!text.includes("passwordHash"))
      assert.ok(text.includes(employees[index].id))
      const updated = await request(
        `/employees/${employees[index].id}`,
        "PUT",
        { position: "Senior Specialist" },
      )
      assert.equal(updated.status, 200)
      const created = await request(
        `/departments/${department.id}/teams`,
        "POST",
        { name: `Team ${index}`, memberIds: [employees[index].id] },
      )
      assert.equal(created.status, 201, await created.clone().text())
      const team = ((await created.json()) as { team: { id: string } }).team
      assert.equal(
        (
          await request(
            `/departments/${department.id}/teams/${team.id}`,
            "PUT",
            { name: `Updated team ${index}` },
          )
        ).status,
        200,
      )
      assert.equal(
        (
          await request(
            `/departments/${departments[1 - index].id}/teams/${team.id}`,
            "PUT",
            { name: "Wrong parent" },
          )
        ).status,
        404,
      )
      assert.equal(
        (
          await request(`/departments/${department.id}/teams`, "POST", {
            name: "Wrong department member",
            memberIds: [employees[1 - index].id],
          })
        ).status,
        400,
      )
      assert.equal(
        (
          await request(
            `/departments/${department.id}/teams/${team.id}`,
            "DELETE",
          )
        ).status,
        200,
      )
      assert.equal(
        (
          await prisma.employee.findUniqueOrThrow({
            where: { id: employees[index].id },
          })
        ).teamId,
        null,
      )
      const listing = await request(`/employees?departmentId=${department.id}`)
      assert.equal(listing.status, 200)
      const filtered = (await listing.json()) as { employees: { id: string }[] }
      assert.ok(
        filtered.employees.some((row) => row.id === employees[index].id),
      )
      assert.ok(
        !filtered.employees.some((row) => row.id === employees[1 - index].id),
      )
      assert.equal(
        (await request(`/employees/${employees[index].id}/status-options`))
          .status,
        200,
      )
      assert.equal(
        (await request(`/employees/${employees[index].id}`)).status,
        200,
      )
    }
    assert.equal(
      (
        await request(`/departments/${departments[0].id}/teams`, "POST", {
          name: "Head cannot join team",
          memberIds: [headEmployee.id],
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await request(`/departments/${departments[1].id}`, "PUT", {
          headId: sa.user.id,
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await request(`/departments/${departments[1].id}/teams`, "POST", {
          name: "Admin cannot lead",
          leadId: admin.user.id,
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await request(`/departments/${departments[1].id}/members`, "POST", {
          userIds: [sa.user.id],
        })
      ).status,
      400,
    )
    for (const path of [
      "/employees",
      "/employees?archived=true",
      "/departments",
      "/departments/eligible-heads",
      "/departments/employee-options",
    ]) {
      const response = await request(path)
      assert.equal(response.status, 200, path)
      const text = await response.text()
      assert.ok(!text.includes("PRIVATE-HASH"))
      if (path.startsWith("/employees"))
        assert.ok(!text.includes(sa.user.email))
    }
    const loginTarget = employees[1].id
    assert.equal(
      (
        await request(`/employees/${loginTarget}/account/status`, "PATCH", {
          isActive: false,
        })
      ).status,
      204,
    )
    assert.equal(
      (await request(`/employees/${loginTarget}/account`, "DELETE")).status,
      204,
    )
    const archive = await request("/employees?archived=true")
    assert.ok(
      (
        (await archive.json()) as { employees: { id: string }[] }
      ).employees.some((row) => row.id === loginTarget),
    )
    const adminEmployee = await prisma.employee.create({
      data: {
        employeeId: "EXP-ADMIN",
        fullName: "Admin",
        userId: admin.user.id,
      },
    })
    assert.equal(
      (
        await request(
          `/employees/${adminEmployee.id}/account/status`,
          "PATCH",
          { isActive: false },
        )
      ).status,
      403,
    )
    assert.equal(
      (await request(`/employees/${adminEmployee.id}/account`, "DELETE"))
        .status,
      403,
    )
    assert.equal(
      (
        await request(`/employees/${adminEmployee.id}`, "PUT", {
          position: "Administrator",
        })
      ).status,
      200,
    )
    const forbiddenProfile = await request(
      `/employees/accounts/${sa.user.id}/profile`,
      "POST",
      {
        employeeId: "EXP-NO-SUPERADMIN",
        fullName: "Superadmin",
        email: sa.user.email,
        contactNumber: "09123456789",
        position: "Administrator",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: "2026-01-01",
        departmentId: departments[0].id,
        teamId: null,
      },
    )
    assert.equal(
      forbiddenProfile.status,
      404,
      await forbiddenProfile.clone().text(),
    )
    for (const who of [staff, head, client]) {
      for (const path of [
        "/employees",
        `/employees/${employees[0].id}`,
        `/employees/${employees[0].id}/status-options`,
      ])
        assert.equal(
          (await request(path, "GET", undefined, who)).status,
          403,
          `${who.user.role}: ${path}`,
        )
      for (const [path, method, body] of [
        ["/employees", "POST", {}],
        [`/employees/${employees[0].id}`, "PUT", { position: "Unauthorized" }],
        ["/departments", "POST", { name: "Unauthorized" }],
        [`/departments/${departments[0].id}`, "PUT", { name: "Unauthorized" }],
        [
          `/departments/${departments[0].id}/teams`,
          "POST",
          { name: "Unauthorized" },
        ],
      ] as const)
        assert.equal((await request(path, method, body, who)).status, 403)
      assert.equal(
        (await request("/departments", "GET", undefined, who)).status,
        who.user.role === "USER" ? 403 : 200,
      )
    }
    assert.equal(
      (
        await request(
          `/employees/${employees[0].id}`,
          "PUT",
          { position: "Admin managed" },
          admin,
        )
      ).status,
      200,
    )
    assert.equal(
      (
        await request(
          `/departments/${departments[0].id}`,
          "PUT",
          { description: "Admin managed" },
          admin,
        )
      ).status,
      200,
    )
    assert.equal(
      (
        await request(`/employees/${employees[0].id}`, "PUT", {
          userId: sa.user.id,
        })
      ).status,
      400,
    )
    assert.equal(
      await prisma.employee.count({ where: { userId: sa.user.id } }),
      0,
    )
    assert.equal(
      await prisma.department.count({ where: { headId: sa.user.id } }),
      0,
    )
    assert.equal(await prisma.team.count({ where: { leadId: sa.user.id } }), 0)
    assert.equal(
      await prisma.employee.count({
        where: { id: { in: employeeAccounts.map((row) => row.id) } },
      }),
      2,
    )
    await prisma.user.update({
      where: { id: sa.user.id },
      data: { role: "STAFF" },
    })
    assert.equal((await request("/employees")).status, 403)
    assert.equal(
      (
        await request(`/departments/${departments[0].id}`, "PUT", {
          name: "No longer authorized",
        })
      ).status,
      403,
    )
  },
)
