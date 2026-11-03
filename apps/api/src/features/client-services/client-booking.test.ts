import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../app.js"
import { getPrisma } from "../../lib/db.js"
import { hashPassword } from "../auth/auth.password.js"
import { issueSession } from "../auth/auth.service.js"
import {
  BillingInterval,
  EmployeeStatus,
  PricingModel,
  Role,
} from "../../generated/prisma/client.js"

test(
  "service request booking engine enforces idempotency, atomic transactions, and payload hardening",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const database = new PGlite()
    const socket = new PGLiteSocketServer({
      db: database,
      host: "127.0.0.1",
      port: 0,
    })
    const cleanup: {
      prisma?: ReturnType<typeof getPrisma>
      server?: ReturnType<ReturnType<typeof createApp>["listen"]>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await socket.stop()
      await database.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    await database.waitReady
    const migrations = new URL("../../../prisma/migrations/", import.meta.url)
    for (const directory of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await database.exec(
        await readFile(
          new URL(`${directory}/migration.sql`, migrations),
          "utf8",
        ),
      )
    }
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/client`

    // Seed test users & roles
    const passwordHash = await hashPassword("ClientPassword123!")
    const clientUser = await prisma.user.create({
      data: {
        email: "booking.client@nexus.com",
        fullName: "Booking Client",
        passwordHash,
        role: Role.USER,
        isActive: true,
      },
    })
    const adminUser = await prisma.user.create({
      data: {
        email: "booking.admin@nexus.com",
        fullName: "Booking Admin",
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    })

    const clientSession = await issueSession(clientUser)
    const clientHeaders = {
      authorization: `Bearer ${clientSession.token}`,
      "content-type": "application/json",
    }
    const adminSession = await issueSession(adminUser)
    const adminHeaders = {
      authorization: `Bearer ${adminSession.token}`,
      "content-type": "application/json",
    }

    // Seed Departments
    const itDept = await prisma.department.create({
      data: { code: "IT", name: "Information Technology" },
    })
    const marketingDept = await prisma.department.create({
      data: { code: "MKT", name: "Digital Marketing" },
    })

    // Seed Specialists
    const itSpecialistUser = await prisma.user.create({
      data: {
        email: "it.specialist@nexus.com",
        fullName: "Alex Rivera",
        passwordHash,
        role: Role.STAFF,
        isActive: true,
      },
    })
    const itSpecialist = await prisma.employee.create({
      data: {
        employeeId: "EMP-IT-001",
        fullName: "Alex Rivera",
        position: "Senior Full-Stack Developer",
        email: "it.specialist@nexus.com",
        contactNumber: "09123456781",
        departmentId: itDept.id,
        userId: itSpecialistUser.id,
        status: EmployeeStatus.ACTIVE,
      },
    })

    const mktSpecialistUser = await prisma.user.create({
      data: {
        email: "mkt.specialist@nexus.com",
        fullName: "Sophia Chen",
        passwordHash,
        role: Role.STAFF,
        isActive: true,
      },
    })
    const mktSpecialist = await prisma.employee.create({
      data: {
        employeeId: "EMP-MKT-001",
        fullName: "Sophia Chen",
        position: "Content Strategist",
        email: "mkt.specialist@nexus.com",
        contactNumber: "09123456782",
        departmentId: marketingDept.id,
        userId: mktSpecialistUser.id,
        status: EmployeeStatus.ACTIVE,
      },
    })

    // Seed Inactive Specialist
    const inactiveSpecialistUser = await prisma.user.create({
      data: {
        email: "inactive.specialist@nexus.com",
        fullName: "Inactive Staff",
        passwordHash,
        role: Role.STAFF,
        isActive: false,
      },
    })
    const inactiveSpecialist = await prisma.employee.create({
      data: {
        employeeId: "EMP-IT-999",
        fullName: "Inactive Staff",
        position: "Junior Developer",
        email: "inactive.specialist@nexus.com",
        contactNumber: "09123456789",
        departmentId: itDept.id,
        userId: inactiveSpecialistUser.id,
        status: EmployeeStatus.INACTIVE,
      },
    })

    // Seed Active Service with tiered packages
    const activeService = await prisma.service.create({
      data: {
        name: "Custom Web Application",
        description: "Full-stack web application development.",
        iconKey: "Code",
        isActive: true,
        departments: { connect: [{ id: itDept.id }] },
        packages: {
          create: [
            {
              name: "Starter",
              description: "MVP web application",
              includedFeatures: ["Frontend", "API"],
              pricingModel: PricingModel.FIXED,
              currency: "PHP",
              amount: 25000,
              isPricingPublic: true,
              displayOrder: 1,
              isActive: true,
            },
            {
              name: "Enterprise",
              description: "Scalable enterprise web application",
              includedFeatures: ["Microservices", "CI/CD"],
              pricingModel: PricingModel.RECURRING,
              currency: "PHP",
              amount: 85000,
              billingInterval: BillingInterval.MONTHLY,
              isPricingPublic: true,
              displayOrder: 2,
              isActive: true,
            },
            {
              name: "Archived Package",
              description: "Deprecated tier",
              includedFeatures: [],
              pricingModel: PricingModel.FIXED,
              currency: "PHP",
              amount: 10000,
              isPricingPublic: true,
              displayOrder: 3,
              isActive: false,
            },
          ],
        },
      },
      include: { packages: true },
    })

    // Seed Inactive Service
    const inactiveService = await prisma.service.create({
      data: {
        name: "Legacy Hosting",
        description: "Deprecated hosting service.",
        iconKey: "Server",
        isActive: false,
      },
    })

    const starterPackage = activeService.packages.find(
      (p) => p.name === "Starter",
    )!
    const archivedPackage = activeService.packages.find(
      (p) => p.name === "Archived Package",
    )!

    const postBooking = (
      body: unknown,
      headers: Record<string, string> = clientHeaders,
    ) =>
      fetch(`${base}/service-requests`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

    // 1. RBAC Tests
    await t.test("enforces strict authentication and role guards", async () => {
      const validPayload = {
        serviceId: activeService.id,
        packageId: starterPackage.id,
        preferredSpecialistId: itSpecialist.id,
        goals: "Build an MVP portal",
        requirements: "React + Next.js frontend with Express backend",
        expectedTimeline: "4 weeks",
        additionalDetails: "Include dark mode support",
      }

      // Anonymous -> 401
      const unauth = await postBooking(validPayload, {
        "content-type": "application/json",
      })
      assert.equal(unauth.status, 401)

      // Admin role -> 403 Forbidden
      const adminAttempt = await postBooking(validPayload, adminHeaders)
      assert.equal(adminAttempt.status, 403)
    })

    // 2. First-time Creation with Standard Web Payload
    let firstReceiptId = ""
    const testSubmissionKey = randomUUID()

    await t.test(
      "successfully submits a booking with complete standard web payload",
      async () => {
        const payload = {
          serviceId: activeService.id,
          packageId: starterPackage.id,
          preferredSpecialistId: itSpecialist.id,
          submissionKey: testSubmissionKey,
          goals: "Build an MVP portal",
          requirements: "React + Next.js frontend with Express backend",
          expectedTimeline: "4 weeks",
          additionalDetails: "Include dark mode support",
        }

        const res = await postBooking(payload)
        assert.equal(res.status, 201)
        const data = (await res.json()) as {
          serviceRequest: {
            id: string
            referenceNumber: string
            status: string
            createdAt: string
          }
        }
        assert.ok(data.serviceRequest.id)
        assert.match(data.serviceRequest.referenceNumber, /^SR-[A-Z0-9-]+$/)
        assert.equal(data.serviceRequest.status, "SUBMITTED")
        firstReceiptId = data.serviceRequest.id

        // Verify database persistence
        const record = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: firstReceiptId },
          include: { service: true, package: true, preferredSpecialist: true },
        })
        assert.equal(record.clientId, clientUser.id)
        assert.equal(record.serviceId, activeService.id)
        assert.equal(record.packageId, starterPackage.id)
        assert.equal(record.packageName, "Starter")
        assert.equal(record.preferredSpecialistId, itSpecialist.id)
        assert.equal(record.preferredSpecialistName, "Alex Rivera")
        assert.equal(record.projectGoals, "Build an MVP portal")
        assert.equal(
          record.projectRequirements,
          "React + Next.js frontend with Express backend",
        )
        assert.equal(record.expectedTimeline, "4 weeks")
        assert.equal(record.additionalDetails, "Include dark mode support")
        assert.equal(record.submissionKey, testSubmissionKey)
        assert.equal(record.status, "SUBMITTED")
        assert.equal(Number(record.quotedPrice), 25000)
      },
    )

    // 3. Idempotency Guarantees
    await t.test(
      "replays identical booking under same submissionKey without creating duplicate records",
      async () => {
        const countBefore = await prisma.serviceRequest.count()
        const payload = {
          serviceId: activeService.id,
          packageId: starterPackage.id,
          preferredSpecialistId: itSpecialist.id,
          submissionKey: testSubmissionKey,
          goals: "Build an MVP portal",
          requirements: "React + Next.js frontend with Express backend",
          expectedTimeline: "4 weeks",
          additionalDetails: "Include dark mode support",
        }

        const res = await postBooking(payload)
        assert.equal(res.status, 201)
        const data = (await res.json()) as {
          serviceRequest: { id: string; status: string }
        }
        assert.equal(data.serviceRequest.id, firstReceiptId)
        assert.equal(data.serviceRequest.status, "SUBMITTED")

        const countAfter = await prisma.serviceRequest.count()
        assert.equal(countAfter, countBefore)
      },
    )

    await t.test(
      "rejects conflicting details under already-used submissionKey with 409 Conflict",
      async () => {
        const conflictingPayload = {
          serviceId: activeService.id,
          packageId: starterPackage.id,
          preferredSpecialistId: itSpecialist.id,
          submissionKey: testSubmissionKey,
          goals: "Different goals entirely",
          requirements: "React + Next.js frontend with Express backend",
          expectedTimeline: "4 weeks",
          additionalDetails: "Include dark mode support",
        }

        const res = await postBooking(conflictingPayload)
        assert.equal(res.status, 409)
        const body = (await res.json()) as { error: string }
        assert.match(body.error, /already submitted with different details/i)
      },
    )

    // 4. Mobile Payload Aliases & Optional SubmissionKey
    await t.test(
      "supports mobile payload with packageTier, specialistId, projectRequirements, and server-generated submissionKey",
      async () => {
        const mobilePayload = {
          serviceId: activeService.id,
          packageTier: "Enterprise",
          specialistId: itSpecialist.id,
          projectRequirements:
            "High-traffic ecommerce platform with mobile API",
          expectedTimeline: "8 weeks",
          additionalDetails: "Requires payment gateway integration",
          // submissionKey omitted -> server must generate one
        }

        const res = await postBooking(mobilePayload)
        assert.equal(res.status, 201)
        const data = (await res.json()) as {
          serviceRequest: { id: string; referenceNumber: string }
        }
        assert.ok(data.serviceRequest.id)

        const record = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: data.serviceRequest.id },
        })
        assert.equal(record.packageName, "Enterprise")
        assert.equal(record.preferredSpecialistId, itSpecialist.id)
        assert.equal(
          record.projectRequirements,
          "High-traffic ecommerce platform with mobile API",
        )
        assert.equal(
          record.projectGoals,
          "High-traffic ecommerce platform with mobile API",
        )
        assert.ok(record.submissionKey)
        assert.match(
          record.submissionKey!,
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        )
        assert.equal(Number(record.quotedPrice), 85000)
      },
    )

    // 5. Inactive & Missing Service Protection
    await t.test(
      "rejects booking for inactive or non-existent service",
      async () => {
        const inactivePayload = {
          serviceId: inactiveService.id,
          packageTier: "Starter",
          projectRequirements: "Try booking inactive",
          expectedTimeline: "1 week",
        }
        const resInactive = await postBooking(inactivePayload)
        assert.equal(resInactive.status, 409)

        const missingPayload = {
          serviceId: "non-existent-service-id",
          packageTier: "Starter",
          projectRequirements: "Try booking missing",
          expectedTimeline: "1 week",
        }
        const resMissing = await postBooking(missingPayload)
        assert.equal(resMissing.status, 409)
      },
    )

    // 6. Inactive or Unknown Package Tier Protection
    await t.test(
      "rejects booking with archived package or unknown package tier",
      async () => {
        const archivedPayload = {
          serviceId: activeService.id,
          packageId: archivedPackage.id,
          projectRequirements: "Try booking archived package",
          expectedTimeline: "1 week",
        }
        const resArchived = await postBooking(archivedPayload)
        assert.equal(resArchived.status, 409)

        const unknownTierPayload = {
          serviceId: activeService.id,
          packageTier: "UltraPremiumTierNonExistent",
          projectRequirements: "Try booking unknown tier",
          expectedTimeline: "1 week",
        }
        const resUnknown = await postBooking(unknownTierPayload)
        assert.equal(resUnknown.status, 409)
      },
    )

    // 7. Specialist Departmental Association & Status Protection
    await t.test(
      "rejects specialists not associated with the service department or inactive",
      async () => {
        // Specialist from Marketing Department cannot be booked for IT service
        const wrongDeptPayload = {
          serviceId: activeService.id,
          packageTier: "Starter",
          specialistId: mktSpecialist.id,
          projectRequirements: "Try booking wrong department specialist",
          expectedTimeline: "2 weeks",
        }
        const resWrongDept = await postBooking(wrongDeptPayload)
        assert.equal(resWrongDept.status, 409)
        const bodyWrong = (await resWrongDept.json()) as { error: string }
        assert.match(
          bodyWrong.error,
          /preferred specialist is no longer listed/i,
        )

        // Inactive staff specialist cannot be booked
        const inactiveStaffPayload = {
          serviceId: activeService.id,
          packageTier: "Starter",
          specialistId: inactiveSpecialist.id,
          projectRequirements: "Try booking inactive specialist",
          expectedTimeline: "2 weeks",
        }
        const resInactive = await postBooking(inactiveStaffPayload)
        assert.equal(resInactive.status, 409)
      },
    )

    // 8. Payload Validation Edge Cases
    await t.test(
      "rejects malformed payloads with 400 Bad Request",
      async () => {
        const baseValid = {
          serviceId: activeService.id,
          packageTier: "Starter",
          projectRequirements: "Valid requirements",
          expectedTimeline: "2 weeks",
        }

        // Empty submission key
        assert.equal(
          (await postBooking({ ...baseValid, submissionKey: "" })).status,
          400,
        )
        // Invalid UUID submission key
        assert.equal(
          (await postBooking({ ...baseValid, submissionKey: "not-a-uuid" }))
            .status,
          400,
        )
        // Missing requirements and goals
        assert.equal(
          (
            await postBooking({
              serviceId: activeService.id,
              packageTier: "Starter",
              expectedTimeline: "2 weeks",
            })
          ).status,
          400,
        )
        // Missing expected timeline
        assert.equal(
          (
            await postBooking({
              serviceId: activeService.id,
              packageTier: "Starter",
              projectRequirements: "Has requirements",
            })
          ).status,
          400,
        )
      },
    )
  },
)
