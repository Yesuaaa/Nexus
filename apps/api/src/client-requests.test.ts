import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { Role, type User } from "./generated/prisma/client.js"
import { getPrisma } from "./lib/db.js"

test(
  "Client portal service request submission and dynamic requirements validation",
  { timeout: 90_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    }
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
      const token = createHash("sha256").update(role).digest("base64url")
      tokens.set(role, token)
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 120_000),
        },
      })
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
    const clientBToken = createHash("sha256")
      .update("CLIENT_B")
      .digest("base64url")
    tokens.set("CLIENT_B", clientBToken)
    await prisma.session.create({
      data: {
        userId: clientB.id,
        tokenHash: createHash("sha256").update(clientBToken).digest("hex"),
        expiresAt: new Date(Date.now() + 120_000),
      },
    })

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

    await t.test(
      "Access control: client routes require authenticated USER role",
      async () => {
        // Anonymous
        assert.equal((await fetch(`${base}/services`)).status, 401)
        // Admin / Staff are blocked from client endpoints (clients only)
        assert.equal((await request("/services", "ADMIN")).status, 403)
        assert.equal((await request("/services", "STAFF")).status, 403)
        // Client succeeds
        assert.equal((await request("/services", "USER")).status, 200)
      },
    )

    await t.test(
      "Catalog query: returns only active services and active packages",
      async () => {
        const response = await request("/services", "USER")
        assert.equal(response.status, 200)
        const data = (await response.json()) as {
          services: { id: string; name: string; packages: { id: string }[] }[]
        }

        const foundActive = data.services.find((s) => s.id === activeService.id)
        const foundInactive = data.services.find(
          (s) => s.id === inactiveService.id,
        )
        assert.ok(foundActive)
        assert.equal(foundInactive, undefined)

        // Packages should only contain active ones
        assert.ok(foundActive.packages.some((p) => p.id === activePackage.id))
        assert.equal(
          foundActive.packages.some((p) => p.id === inactivePackage.id),
          false,
        )
      },
    )

    await t.test(
      "Specialist eligibility: lists only active employees from responsible departments",
      async () => {
        const response = await request(
          `/services/${activeService.id}/specialists`,
          "USER",
        )
        assert.equal(response.status, 200)
        const data = (await response.json()) as {
          specialists: { id: string; fullName: string }[]
        }

        // Alice is in Department A and ACTIVE -> eligible
        assert.ok(data.specialists.some((s) => s.id === specialistA.id))
        // Bob is in Department B (not assigned to this service) -> not eligible
        assert.equal(
          data.specialists.some((s) => s.id === specialistOtherDept.id),
          false,
        )
        // Charlie is INACTIVE -> excluded
        assert.equal(
          data.specialists.some((s) => s.id === specialistInactive.id),
          false,
        )
      },
    )

    await t.test(
      "Validation: rejects invalid payloads, packages, or specialist assignments",
      async () => {
        // Missing title
        assert.equal(
          (
            await request("/service-requests", "USER", "POST", {
              serviceId: activeService.id,
              title: "",
            })
          ).status,
          400,
        )

        // Inactive service
        assert.equal(
          (
            await request("/service-requests", "USER", "POST", {
              serviceId: inactiveService.id,
              title: "Valid Title",
            })
          ).status,
          400,
        )

        // Inactive package
        assert.equal(
          (
            await request("/service-requests", "USER", "POST", {
              serviceId: activeService.id,
              packageId: inactivePackage.id,
              title: "Valid Title",
            })
          ).status,
          400,
        )

        // Specialist from wrong department
        assert.equal(
          (
            await request("/service-requests", "USER", "POST", {
              serviceId: activeService.id,
              preferredSpecialistId: specialistOtherDept.id,
              title: "Valid Title",
            })
          ).status,
          400,
        )
      },
    )

    await t.test(
      "Creation: creates service request with reference number and snapshots package pricing",
      async () => {
        const response = await request("/service-requests", "USER", "POST", {
          serviceId: activeService.id,
          packageId: activePackage.id,
          preferredSpecialistId: specialistA.id,
          title: "Complete Portal Revamp",
          description: "Need full accessibility overhaul.",
          requirementsPayload: {
            brandGuidelinesUrl: "https://example.com/brand.pdf",
            timelineMonths: 3,
          },
        })
        assert.equal(response.status, 201)
        const data = (await response.json()) as {
          serviceRequest: {
            id: string
            referenceNumber: string
            status: string
            title: string
            packageName: string
            service: { id: string }
            package: { id: string }
            preferredSpecialist: { id: string }
          }
        }
        assert.ok(data.serviceRequest.id)
        assert.match(data.serviceRequest.referenceNumber, /^SR-\d{8}-\d{4}$/)
        assert.equal(data.serviceRequest.status, "PENDING")
        assert.equal(data.serviceRequest.title, "Complete Portal Revamp")
        assert.equal(data.serviceRequest.packageName, "Enterprise Overhaul")
        assert.equal(data.serviceRequest.preferredSpecialist.id, specialistA.id)

        // Verify in DB
        const record = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: data.serviceRequest.id },
        })
        assert.equal(record.clientId, users.get("USER")!.id)
        assert.equal(record.pricingModel, "FIXED")
        assert.equal(Number(record.agreedPrice), 150000.0)
        assert.equal(record.currency, "PHP")
        assert.deepEqual(record.requirementsPayload, {
          brandGuidelinesUrl: "https://example.com/brand.pdf",
          timelineMonths: 3,
        })
      },
    )

    await t.test(
      "Multi-tenant isolation: clients can only list their own requests",
      async () => {
        // USER has 1 request created above
        const userRes = await request("/service-requests", "USER")
        assert.equal(userRes.status, 200)
        const userData = (await userRes.json()) as {
          requests: { id: string }[]
          total: number
        }
        assert.equal(userData.total, 1)

        // CLIENT_B has 0 requests
        const clientBRes = await request("/service-requests", "CLIENT_B")
        assert.equal(clientBRes.status, 200)
        const clientBData = (await clientBRes.json()) as {
          requests: unknown[]
          total: number
        }
        assert.equal(clientBData.total, 0)
        assert.deepEqual(clientBData.requests, [])
      },
    )
  },
)
