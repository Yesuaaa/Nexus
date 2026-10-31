import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import {
  Role,
  ServiceRequestStatus,
  type User,
} from "./generated/prisma/client.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"

test("request lifecycle migration preserves legacy records and supports already upgraded databases", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
      CREATE TABLE requests (id integer, status "ServiceRequestStatus" DEFAULT 'PENDING');
      INSERT INTO requests VALUES (1, 'PENDING'), (2, 'IN_PROGRESS'), (3, 'COMPLETED'), (4, 'CANCELLED');
    `)
    const sql = await readFile(
      new URL(
        "../prisma/migrations/20261030220000_align_service_request_statuses/migration.sql",
        import.meta.url,
      ),
      "utf8",
    )
    await db.exec(sql)
    await db.exec(sql)
    await db.exec("INSERT INTO requests (id) VALUES (5)")
    const result = await db.query<{ status: string }>(
      "SELECT status::text FROM requests ORDER BY id",
    )
    assert.deepEqual(
      result.rows.map((row) => row.status),
      ["SUBMITTED", "UNDER_REVIEW", "CLOSED", "CANCELLED", "SUBMITTED"],
    )
    const statuses = await db.query<{ enumlabel: string }>(
      "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ServiceRequestStatus'",
    )
    assert.deepEqual(
      statuses.rows.map((row) => row.enumlabel).sort(),
      Object.values(ServiceRequestStatus).sort(),
    )
  } finally {
    await db.close()
  }
})

test("combined inbox and client lifecycle migrations preserve status history and defaults", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
      CREATE TABLE "ServiceRequest" (id integer PRIMARY KEY, status "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING');
      CREATE TABLE "ServiceRequestHistory" (id integer, "fromStatus" "ServiceRequestStatus", "toStatus" "ServiceRequestStatus" DEFAULT 'IN_PROGRESS');
      CREATE INDEX history_status ON "ServiceRequestHistory" ("toStatus");
      INSERT INTO "ServiceRequest" VALUES (1, 'PENDING'), (2, 'IN_PROGRESS'), (3, 'COMPLETED');
      INSERT INTO "ServiceRequestHistory" VALUES (1, NULL, 'PENDING'), (2, 'PENDING', 'IN_PROGRESS'), (3, 'IN_PROGRESS', 'COMPLETED');
    `)
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    await db.exec(
      await readFile(
        new URL(
          "20261030153000_department_request_inbox/migration.sql",
          migrations,
        ),
        "utf8",
      ),
    )
    await db.exec(
      `INSERT INTO "ServiceRequest" VALUES (4, 'UNDER_REVIEW'); INSERT INTO "ServiceRequestHistory" VALUES (4, 'IN_PROGRESS', 'UNDER_REVIEW');`,
    )
    const reconciliation = await readFile(
      new URL(
        "20261030215900_reconcile_inbox_request_statuses/migration.sql",
        migrations,
      ),
      "utf8",
    )
    await db.exec(reconciliation)
    await db.exec(reconciliation)
    await db.exec(
      await readFile(
        new URL(
          "20261030220000_align_service_request_statuses/migration.sql",
          migrations,
        ),
        "utf8",
      ),
    )
    await db.exec(
      `INSERT INTO "ServiceRequest" (id) VALUES (5); INSERT INTO "ServiceRequestHistory" (id) VALUES (5);`,
    )
    const statuses = await db.query<{ status: string }>(
      `SELECT status::text FROM "ServiceRequest" ORDER BY id`,
    )
    assert.deepEqual(
      statuses.rows.map((row) => row.status),
      ["SUBMITTED", "UNDER_REVIEW", "CLOSED", "UNDER_REVIEW", "SUBMITTED"],
    )
    const history = await db.query<{
      fromStatus: string | null
      toStatus: string
    }>(
      `SELECT "fromStatus"::text, "toStatus"::text FROM "ServiceRequestHistory" ORDER BY id`,
    )
    assert.deepEqual(history.rows, [
      { fromStatus: null, toStatus: "SUBMITTED" },
      { fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW" },
      { fromStatus: "UNDER_REVIEW", toStatus: "CLOSED" },
      { fromStatus: "UNDER_REVIEW", toStatus: "UNDER_REVIEW" },
      { fromStatus: null, toStatus: "UNDER_REVIEW" },
    ])
    const labels = await db.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = to_regtype('"ServiceRequestStatus"')`,
    )
    assert.deepEqual(
      labels.rows.map((row) => row.enumlabel).sort(),
      Object.values(ServiceRequestStatus).sort(),
    )
  } finally {
    await db.close()
  }
})

test(
  "Client portal service request submission and dynamic requirements validation",
  { timeout: 90_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    const cleanup: {
      prisma?: ReturnType<typeof getPrisma>
      server?: ReturnType<ReturnType<typeof createApp>["listen"]>
    } = {}

    t.after(async () => {
      if (cleanup.server) {
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      }
      await cleanup.prisma?.$disconnect()
      await socket.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    await db.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }

    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma

    // Seed roles and sessions
    const tokens = new Map<string, string>()
    const users = new Map<string, User>()
    for (const role of ["ADMIN", "STAFF", "USER"] as const) {
      const email = `${role.toLowerCase()}@example.com`
      const user = await prisma.user.create({
        data: {
          email,
          role,
          fullName: `${role} Account`,
          passwordHash: "hash",
          isActive: true,
        },
      })
      users.set(role, user)
      const { token } = await issueSession(user)
      tokens.set(role, token)
    }

    // Seed a second client to test multi-tenant request isolation
    const clientB = await prisma.user.create({
      data: {
        email: "client.b@example.com",
        role: Role.USER,
        fullName: "Client B",
        passwordHash: "hash",
        isActive: true,
      },
    })
    const { token: clientBToken } = await issueSession(clientB)
    tokens.set("CLIENT_B", clientBToken)

    // Seed Department
    const departmentA = await prisma.department.create({
      data: { name: "Design & Development", code: "DND", color: "blue" },
    })
    const departmentB = await prisma.department.create({
      data: { name: "Marketing", code: "MKT", color: "violet" },
    })

    // Seed Specialists (Employees)
    const specialistA = await prisma.employee.create({
      data: {
        employeeId: "EMP-001",
        fullName: "Alice Specialist",
        userId: users.get("STAFF")!.id,
        position: "Lead UI Designer",
        departmentId: departmentA.id,
        status: "ACTIVE",
      },
    })
    const specialistOtherDept = await prisma.employee.create({
      data: {
        employeeId: "EMP-002",
        fullName: "Bob Marketer",
        position: "SEO Specialist",
        departmentId: departmentB.id,
        status: "ACTIVE",
      },
    })
    const specialistInactive = await prisma.employee.create({
      data: {
        employeeId: "EMP-003",
        fullName: "Charlie OnLeave",
        position: "Staff Developer",
        departmentId: departmentA.id,
        status: "INACTIVE",
      },
    })

    // Seed Services
    const activeService = await prisma.service.create({
      data: {
        name: "Website Redesign",
        description: "Full service web redesign and revamp.",
        isActive: true,
        clientRequirements: ["brandGuidelines", "targetAudience"],
        departments: { connect: [{ id: departmentA.id }] },
      },
    })

    const inactiveService = await prisma.service.create({
      data: {
        name: "Legacy Flash Maintenance",
        description: "Legacy offering no longer available.",
        isActive: false,
        departments: { connect: [{ id: departmentA.id }] },
      },
    })

    // Seed Packages for active service
    const activePackage = await prisma.servicePackage.create({
      data: {
        serviceId: activeService.id,
        name: "Enterprise Overhaul",
        description: "Complete design and build with dedicated support.",
        includedFeatures: ["Wireframes", "Design System", "Custom Code"],
        pricingModel: "FIXED",
        amount: 150000.0,
        currency: "PHP",
        isActive: true,
        displayOrder: 1,
        isRecommended: true,
      },
    })

    const inactivePackage = await prisma.servicePackage.create({
      data: {
        serviceId: activeService.id,
        name: "Deprecated Starter",
        description: "Old tier.",
        pricingModel: "FIXED",
        amount: 20000.0,
        currency: "PHP",
        isActive: false,
      },
    })

    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/client`

    const request = (
      path: string,
      actor = "USER",
      method = "GET",
      body?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${tokens.get(actor)}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

    const input = {
      serviceId: activeService.id,
      packageId: activePackage.id,
      preferredSpecialistId: specialistA.id,
      submissionKey: randomUUID(),
      goals: "Improve accessibility and conversion.",
      requirements: "Build an accessible client portal.",
      expectedTimeline: "Within three months",
      additionalDetails: "Use the existing brand guidelines.",
    }
    await t.test(
      "client routes reject anonymous and non-client accounts",
      async () => {
        for (const path of [
          "/services",
          `/services/${activeService.id}`,
          `/services/${activeService.id}/specialists`,
          "/service-requests",
        ]) {
          assert.equal((await fetch(`${base}${path}`)).status, 401)
          for (const actor of ["ADMIN", "STAFF"])
            assert.equal((await request(path, actor)).status, 403)
        }
        assert.equal(
          (await request("/service-requests", "ADMIN", "POST", input)).status,
          403,
        )
      },
    )
    await t.test(
      "catalog and detail include benefits, image URLs and active packages",
      async () => {
        const list = await request("/services")
        assert.equal(list.status, 200)
        const data = (await list.json()) as {
          services: {
            id: string
            packages: { id: string }[]
            keyBenefits: unknown[]
            imageUrl: string | null
          }[]
        }
        assert.equal(data.services.length, 1)
        assert.equal(data.services[0].id, activeService.id)
        assert.deepEqual(
          data.services[0].packages.map((item) => item.id),
          [activePackage.id],
        )
        assert.ok(Array.isArray(data.services[0].keyBenefits))
        assert.equal(data.services[0].imageUrl, null)
        const detail = await request(`/services/${activeService.id}`)
        assert.equal(detail.status, 200)
        assert.deepEqual(
          ((await detail.json()) as { service: unknown }).service,
          data.services[0],
        )
        assert.equal(
          (await request(`/services/${inactiveService.id}`)).status,
          404,
        )
      },
    )
    await t.test(
      "specialists require an active staff login in a responsible department",
      async () => {
        const noAccount = await prisma.employee.create({
          data: {
            employeeId: "EMP-NO-LOGIN",
            fullName: "No Login",
            departmentId: departmentA.id,
            status: "ACTIVE",
          },
        })
        const response = await request(
          `/services/${activeService.id}/specialists`,
        )
        assert.equal(response.status, 200)
        const { specialists } = (await response.json()) as {
          specialists: { id: string }[]
        }
        assert.deepEqual(
          specialists.map((item) => item.id),
          [specialistA.id],
        )
        assert.ok(
          !specialists.some((item) =>
            [
              noAccount.id,
              specialistInactive.id,
              specialistOtherDept.id,
            ].includes(item.id),
          ),
        )
      },
    )
    await t.test(
      "submission validates requirements, package and specialist eligibility",
      async () => {
        for (const change of [
          { goals: "" },
          { requirements: "" },
          { expectedTimeline: "" },
          { submissionKey: "invalid" },
        ]) {
          assert.equal(
            (
              await request("/service-requests", "USER", "POST", {
                ...input,
                ...change,
              })
            ).status,
            400,
          )
        }
        for (const change of [
          { serviceId: inactiveService.id },
          { packageId: inactivePackage.id },
          { packageId: null },
          { preferredSpecialistId: specialistOtherDept.id },
        ]) {
          assert.equal(
            (
              await request("/service-requests", "USER", "POST", {
                ...input,
                ...change,
              })
            ).status,
            409,
          )
        }
      },
    )
    let requestId = ""
    await t.test(
      "submission snapshots public pricing, preserves requirements and safely replays retries",
      async () => {
        const response = await request("/service-requests", "USER", "POST", {
          ...input,
          clientId: clientB.id,
        })
        assert.equal(response.status, 201)
        const receipt = (
          (await response.json()) as {
            serviceRequest: {
              id: string
              referenceNumber: string
              status: string
            }
          }
        ).serviceRequest
        requestId = receipt.id
        assert.match(receipt.referenceNumber, /^SR-[A-F0-9-]{36}$/)
        assert.equal(receipt.status, "SUBMITTED")
        const record = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: receipt.id },
        })
        assert.equal(record.clientId, users.get("USER")!.id)
        assert.equal(record.projectGoals, input.goals)
        assert.equal(record.projectRequirements, input.requirements)
        assert.equal(record.preferredSpecialistName, specialistA.fullName)
        assert.equal(record.packageName, activePackage.name)
        assert.equal(Number(record.quotedPrice), 150000)
        const replay = await request("/service-requests", "USER", "POST", input)
        assert.equal(replay.status, 201)
        assert.deepEqual(
          ((await replay.json()) as { serviceRequest: unknown }).serviceRequest,
          receipt,
        )
        assert.equal(
          (
            await request("/service-requests", "USER", "POST", {
              ...input,
              goals: "Different goals",
            })
          ).status,
          409,
        )
        assert.equal(
          await prisma.serviceRequest.count({
            where: { clientId: users.get("USER")!.id },
          }),
          1,
        )
      },
    )
    await t.test(
      "history scopes records, totals and summary to the signed-in client",
      async () => {
        const response = await request(
          "/service-requests?clientId=" + clientB.id,
        )
        assert.equal(response.status, 200)
        const history = (await response.json()) as {
          requests: {
            id: string
            projectGoals: string
            quotedPrice: string
            clientId?: string
          }[]
          total: number
          summary: { total: number; pending: number }
        }
        assert.equal(history.total, 1)
        assert.equal(history.requests[0].id, requestId)
        assert.equal(history.requests[0].projectGoals, input.goals)
        assert.equal(history.requests[0].clientId, undefined)
        assert.equal(history.summary.total, 1)
        assert.equal(history.summary.pending, 1)
        const other = await request("/service-requests", "CLIENT_B")
        assert.equal(((await other.json()) as { total: number }).total, 0)
      },
    )
    await t.test(
      "hidden prices stay hidden in list, detail, submission and history",
      async () => {
        const template = await prisma.pricingTemplate.create({
          data: {
            name: "Internal rate",
            pricingModel: "FIXED",
            amount: 99999,
            isPublic: false,
          },
        })
        await prisma.service.update({
          where: { id: activeService.id },
          data: { pricingTemplateId: template.id },
        })
        await prisma.servicePackage.update({
          where: { id: activePackage.id },
          data: {
            isPricingPublic: false,
            amount: 88888,
            billingInterval: "MONTHLY",
          },
        })
        for (const path of ["/services", `/services/${activeService.id}`]) {
          const data = (await (await request(path)).json()) as {
            services?: {
              pricingTemplate: unknown
              packages: { amount: unknown; billingInterval: unknown }[]
            }[]
            service?: {
              pricingTemplate: unknown
              packages: { amount: unknown; billingInterval: unknown }[]
            }
          }
          const service = data.service ?? data.services![0]
          assert.equal(service.pricingTemplate, null)
          assert.equal(service.packages[0].amount, null)
          assert.equal(service.packages[0].billingInterval, null)
        }
        const response = await request(
          "/service-requests",
          "CLIENT_B",
          "POST",
          { ...input, preferredSpecialistId: null },
        )
        assert.equal(response.status, 201)
        const history = (await (
          await request("/service-requests", "CLIENT_B")
        ).json()) as {
          requests: { quotedPrice: unknown; pricingModel: string }[]
        }
        assert.equal(history.requests[0].quotedPrice, null)
        assert.equal(history.requests[0].pricingModel, "CUSTOM_QUOTE")
      },
    )
    await t.test(
      "history validates filters, paginates, sorts and searches across all records",
      async () => {
        for (const query of [
          "page=0",
          "page=abc",
          "status=BAD",
          "sortOrder=bad",
          "status=SUBMITTED&status=CLOSED",
          "search=" + "x".repeat(101),
        ])
          assert.equal(
            (await request(`/service-requests?${query}`)).status,
            400,
          )
        for (let index = 0; index < 11; index++)
          await prisma.serviceRequest.create({
            data: {
              clientId: users.get("USER")!.id,
              serviceId: activeService.id,
              title: `Historical request ${index}`,
              status: "CLOSED",
              createdAt: new Date(2026, 0, index + 1),
            },
          })
        const first = (await (await request("/service-requests")).json()) as {
          total: number
          requests: { id: string }[]
          summary: { total: number; completed: number }
        }
        assert.equal(first.total, 12)
        assert.equal(first.requests.length, 10)
        assert.equal(first.summary.total, 12)
        assert.equal(first.summary.completed, 11)
        const second = (await (
          await request("/service-requests?page=2")
        ).json()) as { requests: { id: string }[] }
        assert.equal(second.requests.length, 2)
        assert.ok(
          !second.requests.some((item) =>
            first.requests.some((other) => other.id === item.id),
          ),
        )
        const filtered = (await (
          await request(
            "/service-requests?status=CLOSED&search=Historical%20request%201&sortOrder=asc",
          )
        ).json()) as {
          requests: { title: string }[]
          total: number
          summary: { total: number }
        }
        assert.equal(filtered.total, 2)
        assert.deepEqual(
          filtered.requests.map((item) => item.title),
          ["Historical request 1", "Historical request 10"],
        )
        assert.equal(filtered.summary.total, 12)
        const noMatch = (await (
          await request("/service-requests?search=another-client-secret")
        ).json()) as { total: number }
        assert.equal(noMatch.total, 0)
      },
    )
    await t.test(
      "history reads and filters every manager lifecycle status with accurate totals",
      async () => {
        for (const status of Object.values(ServiceRequestStatus)) {
          await prisma.serviceRequest.create({
            data: {
              clientId: clientB.id,
              serviceId: activeService.id,
              title: `Lifecycle ${status}`,
              status,
            },
          })
        }
        for (const status of Object.values(ServiceRequestStatus)) {
          const response = await request(
            `/service-requests?status=${status}`,
            "CLIENT_B",
          )
          assert.equal(response.status, 200)
          const history = (await response.json()) as {
            requests: { status: string }[]
            total: number
            summary: {
              total: number
              pending: number
              inProgress: number
              completed: number
              cancelled: number
            }
          }
          assert.equal(history.total, status === "SUBMITTED" ? 2 : 1)
          assert.ok(history.requests.every((row) => row.status === status))
          assert.deepEqual(history.summary, {
            total: 7,
            pending: 2,
            inProgress: 3,
            completed: 1,
            cancelled: 1,
          })
        }
      },
    )
  },
)
