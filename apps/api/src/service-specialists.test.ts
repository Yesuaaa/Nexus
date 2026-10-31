import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"

test(
  "client specialist choices are scoped to active service departments and expose only directory details",
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
    const cleanup: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await cleanup.socket?.stop()
      await database.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await database.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }
    const serviceRequestStatuses = await database.query<{ enumlabel: string }>(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'ServiceRequestStatus'
    `)
    assert.deepEqual(
      serviceRequestStatuses.rows.map((row) => row.enumlabel).sort(),
      [
        "AWAITING_CLIENT_INFO",
        "CANCELLED",
        "CLOSED",
        "READY_FOR_QUOTATION",
        "SUBMITTED",
        "UNDER_REVIEW",
      ],
    )
    const socket = new PGLiteSocketServer({
      db: database,
      port: 0,
      host: "127.0.0.1",
    })
    cleanup.socket = socket
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const client = await prisma.user.create({
      data: {
        email: "client@example.com",
        passwordHash: "unused",
        role: "USER",
      },
    })
    const { token } = await issueSession(client)
    const marketing = await prisma.department.create({
      data: { name: "Marketing" },
    })
    const design = await prisma.department.create({ data: { name: "Design" } })
    const other = await prisma.department.create({
      data: { name: "Operations" },
    })
    const service = await prisma.service.create({
      data: {
        name: "Social media",
        description: "Social media services",
        departments: { connect: [{ id: marketing.id }, { id: design.id }] },
      },
    })
    const unassignedService = await prisma.service.create({
      data: { name: "Unassigned", description: "No departments" },
    })
    const inactiveService = await prisma.service.create({
      data: {
        name: "Inactive",
        description: "Inactive service",
        isActive: false,
        departments: { connect: { id: marketing.id } },
      },
    })
    const expected: {
      id: string
      fullName: string
      position: string
      department: { id: string; name: string }
    }[] = []
    for (const [index, scenario] of [
      { name: "Alex Santos", departmentId: marketing.id },
      { name: "Jamie Reyes", departmentId: design.id },
      { name: "Unrelated", departmentId: other.id },
      {
        name: "On leave",
        departmentId: marketing.id,
        status: "ON_LEAVE" as const,
      },
      {
        name: "Inactive employee",
        departmentId: marketing.id,
        status: "INACTIVE" as const,
      },
      { name: "Inactive account", departmentId: marketing.id, isActive: false },
      {
        name: "Retired account",
        departmentId: marketing.id,
        accountDeletedAt: new Date(),
      },
      { name: "Admin", departmentId: marketing.id, role: "ADMIN" as const },
      { name: "Client", departmentId: marketing.id, role: "USER" as const },
      { name: "Unlinked", departmentId: marketing.id, noAccount: true },
    ].entries()) {
      const user = scenario.noAccount
        ? null
        : await prisma.user.create({
            data: {
              email: `staff-${index}@example.com`,
              passwordHash: "private-hash",
              role: scenario.role ?? "STAFF",
              isActive: scenario.isActive ?? true,
              accountDeletedAt: scenario.accountDeletedAt ?? null,
            },
          })
      const employee = await prisma.employee.create({
        data: {
          employeeId: `EXP-${index}`,
          fullName: scenario.name,
          position: "Specialist",
          email: "private@example.com",
          contactNumber: "09123456789",
          departmentId: scenario.departmentId,
          status: scenario.status ?? "ACTIVE",
          userId: user?.id,
        },
      })
      if (index < 2)
        expected.push({
          id: employee.id,
          fullName: employee.fullName,
          position: "Specialist",
          department: {
            id: scenario.departmentId,
            name: index === 0 ? "Marketing" : "Design",
          },
        })
    }
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const headers = { authorization: `Bearer ${token}` }
    const response = await fetch(`${base}/services/${service.id}/specialists`, {
      headers,
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { specialists: expected })
    const profileResponse = await fetch(
      `${base}/services/${service.id}/specialists/${expected[0]!.id}`,
      { headers },
    )
    assert.equal(profileResponse.status, 200)
    const initialProfile = (await profileResponse.json()) as {
      specialist: Record<string, unknown>
    }
    assert.equal(initialProfile.specialist.fullName, "Alex Santos")
    assert.deepEqual(initialProfile.specialist.projects, [])
    assert.deepEqual(initialProfile.specialist.specialties, [])
    assert.equal("email" in initialProfile.specialist, false)
    assert.equal("passwordHash" in initialProfile.specialist, false)
    const empty = await fetch(
      `${base}/services/${unassignedService.id}/specialists`,
      { headers },
    )
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), { specialists: [] })
    for (const id of [inactiveService.id, "missing"]) {
      assert.equal(
        (await fetch(`${base}/services/${id}/specialists`, { headers })).status,
        404,
      )
    }
    assert.equal(
      (await fetch(`${base}/services/${service.id}/specialists`)).status,
      401,
    )
    assert.equal((await fetch(`${base}/employees`, { headers })).status, 403)

    await t.test(
      "specialist profiles show only their published portfolio and safe public fields",
      async () => {
        const employeeId = expected[0]!.id
        await prisma.employee.update({
          where: { id: employeeId },
          data: {
            profileBio: "I help teams plan clear social content.",
            profileSpecialties: ["Content planning", "Brand communication"],
            profileImageUrl: "javascript:alert(1)",
          },
        })
        const published = await prisma.specialistPortfolioProject.create({
          data: {
            employeeId,
            title: "Published content series",
            summary: "A published portfolio example.",
            contribution: "Content direction and layout.",
            isPublished: true,
            thumbnailUrl:
              "https://example.supabase.co/storage/v1/object/public/portfolio/preview.png",
            projectUrl: "https://example.com/work/content-series",
            displayOrder: 0,
          },
        })
        await prisma.specialistPortfolioProject.create({
          data: {
            employeeId,
            title: "Private portfolio draft",
            summary: "Not ready to share",
            isPublished: false,
          },
        })
        await prisma.specialistPortfolioProject.create({
          data: {
            employeeId: expected[1]!.id,
            title: "Another specialist portfolio",
            summary: "Not owned by this specialist",
            isPublished: true,
          },
        })
        await prisma.project.create({
          data: {
            clientId: client.id,
            name: "Confidential client project",
            status: "COMPLETED",
          },
        })
        const response = await fetch(
          `${base}/services/${service.id}/specialists/${employeeId}`,
          { headers },
        )
        assert.equal(response.status, 200)
        const payload = (await response.json()) as {
          specialist: {
            bio: string
            imageUrl: string | null
            specialties: string[]
            projects: Record<string, unknown>[]
          }
        }
        assert.equal(
          payload.specialist.bio,
          "I help teams plan clear social content.",
        )
        assert.equal(payload.specialist.imageUrl, null)
        assert.deepEqual(payload.specialist.specialties, [
          "Content planning",
          "Brand communication",
        ])
        assert.deepEqual(payload.specialist.projects, [
          {
            id: published.id,
            title: published.title,
            summary: published.summary,
            contribution: published.contribution,
            thumbnailUrl: published.thumbnailUrl,
            projectUrl: published.projectUrl,
          },
        ])
        const text = JSON.stringify(payload)
        for (const forbidden of [
          "email",
          "passwordHash",
          "contactNumber",
          "employeeId",
          "isPublished",
          "Private portfolio draft",
          "Confidential client project",
          "Another specialist portfolio",
        ])
          assert.equal(text.includes(forbidden), false, forbidden)
        await prisma.specialistPortfolioProject.update({
          where: { id: published.id },
          data: {
            thumbnailUrl: "data:text/html,bad",
            projectUrl: "https://user:secret@example.com/private",
          },
        })
        const sanitized = await fetch(
          `${base}/services/${service.id}/specialists/${employeeId}`,
          { headers },
        )
        const sanitizedBody = (await sanitized.json()) as {
          specialist: {
            projects: {
              thumbnailUrl: string | null
              projectUrl: string | null
            }[]
          }
        }
        assert.equal(sanitizedBody.specialist.projects[0]!.thumbnailUrl, null)
        assert.equal(sanitizedBody.specialist.projects[0]!.projectUrl, null)
        for (const serviceId of [
          unassignedService.id,
          inactiveService.id,
          "missing",
        ])
          assert.equal(
            (
              await fetch(
                `${base}/services/${serviceId}/specialists/${employeeId}`,
                { headers },
              )
            ).status,
            404,
          )
        const excluded = await prisma.employee.findMany({
          where: { id: { notIn: expected.map((item) => item.id) } },
          select: { id: true },
        })
        for (const candidate of excluded)
          assert.equal(
            (
              await fetch(
                `${base}/services/${service.id}/specialists/${candidate.id}`,
                { headers },
              )
            ).status,
            404,
          )
        assert.equal(
          (
            await fetch(
              `${base}/services/${service.id}/specialists/${employeeId}`,
            )
          ).status,
          401,
        )
        assert.equal(
          (
            await fetch(`${base}/services/${service.id}/specialists/missing`, {
              headers,
            })
          ).status,
          404,
        )
      },
    )

    await t.test(
      "service requests validate the draft and store a pending review with a specialist preference",
      async () => {
        const post = (
          body: unknown,
          authHeaders: Record<string, string> = headers,
        ) =>
          fetch(`${base}/service-requests`, {
            method: "POST",
            headers: { ...authHeaders, "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        const input = {
          serviceId: service.id,
          packageId: null,
          preferredSpecialistId: expected[0]!.id,
          submissionKey: randomUUID(),
          goals: "  Grow our audience  ",
          requirements: " Create a content calendar ",
          expectedTimeline: " Within six weeks ",
          additionalDetails: " Follow our brand guide ",
          clientId: "someone-else",
          status: "COMPLETED",
          agreedPrice: 1,
        }
        for (const invalid of [
          null,
          [],
          { ...input, goals: " " },
          { ...input, requirements: "x".repeat(5001) },
          { ...input, expectedTimeline: "x".repeat(301) },
          { ...input, additionalDetails: 4 },
          { ...input, preferredSpecialistId: "" },
          { ...input, submissionKey: "invalid" },
        ]) {
          assert.equal((await post(invalid)).status, 400)
        }
        assert.equal((await post(input, {})).status, 401)
        assert.equal(await prisma.serviceRequest.count(), 0)
        for (const id of [inactiveService.id, "missing"])
          assert.equal((await post({ ...input, serviceId: id })).status, 409)
        const unrelated = await prisma.employee.findFirstOrThrow({
          where: { fullName: "Unrelated" },
        })
        const onLeave = await prisma.employee.findFirstOrThrow({
          where: { fullName: "On leave" },
        })
        for (const preferredSpecialistId of [
          unrelated.id,
          onLeave.id,
          "missing",
        ])
          assert.equal(
            (await post({ ...input, preferredSpecialistId })).status,
            409,
          )
        const submitted = await post(input)
        assert.equal(submitted.status, 201)
        const receipt = (await submitted.json()) as {
          serviceRequest: { id: string; status: string }
        }
        assert.equal(receipt.serviceRequest.status, "SUBMITTED")
        const record = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: receipt.serviceRequest.id },
        })
        assert.equal(record.clientId, client.id)
        assert.equal(record.status, "SUBMITTED")
        assert.equal(record.projectGoals, "Grow our audience")
        assert.equal(record.projectRequirements, "Create a content calendar")
        assert.equal(record.expectedTimeline, "Within six weeks")
        assert.equal(record.additionalDetails, "Follow our brand guide")
        assert.equal(record.preferredSpecialistId, expected[0]!.id)
        assert.equal(record.preferredSpecialistName, "Alex Santos")
        assert.equal(record.agreedPrice, null)
        const replay = await post(input)
        assert.equal(replay.status, 201)
        assert.deepEqual(await replay.json(), receipt)
        assert.equal(await prisma.serviceRequest.count(), 1)
        assert.equal(
          (await post({ ...input, goals: "Changed goals" })).status,
          409,
        )

        const privatePackage = await prisma.servicePackage.create({
          data: {
            serviceId: service.id,
            name: "Private pricing",
            description: "Private pricing",
            pricingModel: "FIXED",
            amount: 99999,
            isPricingPublic: false,
          },
        })
        const inactivePackage = await prisma.servicePackage.create({
          data: {
            serviceId: service.id,
            name: "Inactive package",
            description: "Inactive",
            pricingModel: "FIXED",
            amount: 1000,
            isActive: false,
          },
        })
        const foreignPackage = await prisma.servicePackage.create({
          data: {
            serviceId: unassignedService.id,
            name: "Other package",
            description: "Other",
            pricingModel: "FIXED",
            amount: 1000,
          },
        })
        for (const packageId of [
          null,
          inactivePackage.id,
          foreignPackage.id,
          "missing",
        ])
          assert.equal(
            (await post({ ...input, submissionKey: randomUUID(), packageId }))
              .status,
            409,
          )
        const privateResponse = await post({
          ...input,
          submissionKey: randomUUID(),
          packageId: privatePackage.id,
          preferredSpecialistId: null,
        })
        assert.equal(privateResponse.status, 201)
        const privateReceipt = (await privateResponse.json()) as {
          serviceRequest: { id: string }
        }
        const privateRecord = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: privateReceipt.serviceRequest.id },
        })
        assert.equal(privateRecord.packageId, privatePackage.id)
        assert.equal(privateRecord.packageName, "Private pricing")
        assert.equal(privateRecord.quotedPrice, null)
        assert.equal(privateRecord.pricingModel, "CUSTOM_QUOTE")
        assert.equal(privateRecord.preferredSpecialistId, null)
        await prisma.servicePackage.update({
          where: { id: privatePackage.id },
          data: { isPricingPublic: true, amount: 2500 },
        })
        const publicResponse = await post({
          ...input,
          submissionKey: randomUUID(),
          packageId: privatePackage.id,
        })
        assert.equal(publicResponse.status, 201)
        const publicReceipt = (await publicResponse.json()) as {
          serviceRequest: { id: string }
        }
        const publicRecord = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: publicReceipt.serviceRequest.id },
        })
        assert.equal(publicRecord.quotedPrice?.toString(), "2500")
        assert.equal(publicRecord.agreedPrice, null)

        const concurrentInput = {
          ...input,
          packageId: privatePackage.id,
          submissionKey: randomUUID(),
          goals: "Grow the audience",
          requirements: "內容".repeat(2500),
          additionalDetails: "詳細".repeat(2500),
        }
        const concurrent = await Promise.all([
          post(concurrentInput),
          post(concurrentInput),
        ])
        for (const result of concurrent) assert.equal(result.status, 201)
        assert.deepEqual(
          await concurrent[0]!.json(),
          await concurrent[1]!.json(),
        )
        assert.equal(
          await prisma.serviceRequest.count({
            where: {
              clientId: client.id,
              submissionKey: concurrentInput.submissionKey,
            },
          }),
          1,
        )

        const staff = await prisma.user.findUniqueOrThrow({
          where: { email: "staff-0@example.com" },
        })
        const { token: staffToken } = await issueSession(staff)
        assert.equal(
          (await post(input, { authorization: `Bearer ${staffToken}` })).status,
          403,
        )
      },
    )

    await t.test(
      "clients read only their own booked services with safe details, filters and stable pages",
      async () => {
        const otherClient = await prisma.user.create({
          data: {
            email: "other-client@example.com",
            passwordHash: "unused",
            role: "USER",
          },
        })
        const existingCount = await prisma.serviceRequest.count({
          where: { clientId: client.id },
        })
        const tiedDate = new Date("2040-01-01T00:00:00Z")
        const bookingIds = Array.from(
          { length: 12 },
          (_, index) => `booking-${String(index).padStart(2, "0")}`,
        )
        await prisma.serviceRequest.createMany({
          data: bookingIds.map((id, index) => ({
            id,
            clientId: client.id,
            serviceId: service.id,
            title: index === 0 ? "Brand refresh" : "Content strategy",
            packageName: index === 0 ? "Premium Growth" : "Standard",
            status: index % 2 === 0 ? "SUBMITTED" : "CLOSED",
            expectedTimeline: "Eight weeks",
            preferredSpecialistName: "Alex Santos",
            projectGoals: "Grow our audience",
            projectRequirements: "A monthly content plan",
            additionalDetails: "Follow our brand guide",
            quotedPrice: 5000,
            agreedPrice: 6000,
            submissionKey: randomUUID(),
            createdAt: tiedDate,
          })),
        })
        const foreign = await prisma.serviceRequest.create({
          data: {
            clientId: otherClient.id,
            serviceId: service.id,
            title: "Brand refresh",
            packageName: "Premium Growth",
            projectRequirements: "Other client's private requirements",
            createdAt: tiedDate,
          },
        })
        const get = (
          path = "",
          authHeaders: Record<string, string> = headers,
        ) => fetch(`${base}/service-requests${path}`, { headers: authHeaders })
        const firstResponse = await get()
        assert.equal(firstResponse.status, 200)
        type Booking = {
          id: string
          title: string
          status: string
          packageName: string | null
          expectedTimeline: string
          preferredSpecialistName: string | null
          createdAt: string
          updatedAt: string
          service: { id: string; name: string }
        }
        type BookingPage = {
          serviceRequests: Booking[]
          total: number
          page: number
          pageSize: number
        }
        const first = (await firstResponse.json()) as BookingPage
        assert.equal(first.total, existingCount + 12)
        assert.equal(first.page, 1)
        assert.equal(first.pageSize, 10)
        assert.deepEqual(
          first.serviceRequests.map((row) => row.id),
          bookingIds.slice(0, 10),
        )
        const safeKeys = [
          "id",
          "title",
          "status",
          "packageName",
          "expectedTimeline",
          "preferredSpecialistName",
          "createdAt",
          "updatedAt",
          "service",
        ].sort()
        for (const row of first.serviceRequests) {
          assert.deepEqual(Object.keys(row).sort(), safeKeys)
          assert.deepEqual(Object.keys(row.service).sort(), ["id", "name"])
        }
        const second = (await (await get("?page=2")).json()) as BookingPage
        assert.equal(second.page, 2)
        assert.deepEqual(
          second.serviceRequests.slice(0, 2).map((row) => row.id),
          bookingIds.slice(10),
        )
        assert.equal(
          new Set(
            [...first.serviceRequests, ...second.serviceRequests].map(
              (row) => row.id,
            ),
          ).size,
          first.total,
        )
        const last = (await (await get("?page=100000")).json()) as BookingPage
        assert.equal(last.total, first.total)
        assert.deepEqual(last.serviceRequests, [])
        for (const search of ["brand refresh", "premium growth"]) {
          const result = (await (
            await get(`?search=${encodeURIComponent(search.toUpperCase())}`)
          ).json()) as BookingPage
          assert.equal(result.total, 1)
          assert.deepEqual(
            result.serviceRequests.map((row) => row.id),
            [bookingIds[0]],
          )
        }
        const referenceSearch = (await (
          await get(`?search=${bookingIds[3].toUpperCase()}`)
        ).json()) as BookingPage
        assert.equal(referenceSearch.total, 1)
        assert.deepEqual(
          referenceSearch.serviceRequests.map((row) => row.id),
          [bookingIds[3]],
        )
        const foreignReferenceSearch = (await (
          await get(`?search=${foreign.id.toUpperCase()}`)
        ).json()) as BookingPage
        assert.deepEqual(foreignReferenceSearch, {
          serviceRequests: [],
          total: 0,
          page: 1,
          pageSize: 10,
        })
        const serviceSearch = (await (
          await get("?search=SOCIAL%20MEDIA")
        ).json()) as BookingPage
        assert.equal(serviceSearch.total, first.total)
        const filtered = (await (
          await get("?search=content%20strategy&status=CLOSED")
        ).json()) as BookingPage
        assert.equal(filtered.total, 6)
        assert.ok(
          filtered.serviceRequests.every((row) => row.status === "CLOSED"),
        )
        const absentStatus = (await (
          await get("?status=READY_FOR_QUOTATION")
        ).json()) as BookingPage
        assert.deepEqual(absentStatus, {
          serviceRequests: [],
          total: 0,
          page: 1,
          pageSize: 10,
        })
        const ignoredOwner = (await (
          await get(`?clientId=${otherClient.id}`)
        ).json()) as BookingPage
        assert.equal(ignoredOwner.total, first.total)
        assert.ok(
          ignoredOwner.serviceRequests.every((row) => row.id !== foreign.id),
        )
        const detailResponse = await get(`/${bookingIds[0]}`)
        assert.equal(detailResponse.status, 200)
        const detail = (await detailResponse.json()) as {
          serviceRequest: Booking & {
            projectGoals: string
            projectRequirements: string
            additionalDetails: string
          }
        }
        assert.deepEqual(
          Object.keys(detail.serviceRequest).sort(),
          [
            ...safeKeys,
            "projectGoals",
            "projectRequirements",
            "additionalDetails",
          ].sort(),
        )
        assert.equal(
          detail.serviceRequest.projectRequirements,
          "A monthly content plan",
        )
        assert.equal(detail.serviceRequest.projectGoals, "Grow our audience")
        assert.equal(
          detail.serviceRequest.additionalDetails,
          "Follow our brand guide",
        )
        for (const path of [`/${foreign.id}`, "/missing"]) {
          const response = await get(path)
          assert.equal(response.status, 404)
          assert.deepEqual(await response.json(), {
            error: "Booked service not found",
          })
        }
        for (const query of [
          "page=0",
          "page=100001",
          "page=1.5",
          "page=1&page=2",
          "search=a&search=b",
          `search=${"x".repeat(101)}`,
          "status=UNKNOWN",
          "status=PENDING&status=COMPLETED",
        ])
          assert.equal((await get(`?${query}`)).status, 400)
        assert.equal((await get("/invalid%20id")).status, 400)
        assert.equal((await get(`/${"x".repeat(81)}`)).status, 400)
        for (const path of ["", `/${bookingIds[0]}`])
          assert.equal((await get(path, {})).status, 401)
        for (const role of ["ADMIN", "SUPERADMIN", "STAFF"] as const) {
          const account = await prisma.user.create({
            data: {
              email: `bookings-${role.toLowerCase()}@example.com`,
              passwordHash: "unused",
              role,
            },
          })
          const session = await issueSession(account)
          const authHeaders = { authorization: `Bearer ${session.token}` }
          for (const path of ["", `/${bookingIds[0]}`])
            assert.equal((await get(path, authHeaders)).status, 403)
        }
        const emptySession = await issueSession(otherClient)
        await prisma.serviceRequest.delete({ where: { id: foreign.id } })
        const empty = (await (
          await get("", { authorization: `Bearer ${emptySession.token}` })
        ).json()) as BookingPage
        assert.deepEqual(empty, {
          serviceRequests: [],
          total: 0,
          page: 1,
          pageSize: 10,
        })
      },
    )

    await t.test(
      "booking submission and replay use the existing normalized database status without migrations",
      async () => {
        await database.exec(`
          ALTER TABLE "ServiceRequest" ALTER COLUMN "status" DROP DEFAULT;
          ALTER TYPE "ServiceRequestStatus" RENAME TO "LegacyServiceRequestStatus";
          CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'CLOSED', 'CANCELLED', 'AWAITING_CLIENT_INFO', 'READY_FOR_QUOTATION');
          ALTER TABLE "ServiceRequest" ALTER COLUMN "status" TYPE "ServiceRequestStatus" USING
            (CASE "status"::text WHEN 'PENDING' THEN 'SUBMITTED' WHEN 'IN_PROGRESS' THEN 'UNDER_REVIEW' WHEN 'COMPLETED' THEN 'CLOSED' ELSE "status"::text END)::"ServiceRequestStatus";
          ALTER TABLE "ServiceRequest" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
          DROP TYPE "LegacyServiceRequestStatus";
        `)
        const normalizedService = await prisma.service.create({
          data: {
            name: "Normalized booking service",
            description: "Client booking",
          },
        })
        const input = {
          serviceId: normalizedService.id,
          packageId: null,
          preferredSpecialistId: null,
          submissionKey: randomUUID(),
          goals: "Launch a new campaign",
          requirements: "Campaign assets",
          expectedTimeline: "Four weeks",
          additionalDetails: "Use existing branding",
        }
        const post = () =>
          fetch(`${base}/service-requests`, {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify(input),
          })
        const submitted = await post()
        assert.equal(submitted.status, 201)
        const receipt = (await submitted.json()) as {
          serviceRequest: { id: string; status: string }
        }
        assert.equal(receipt.serviceRequest.status, "SUBMITTED")
        const replay = await post()
        assert.equal(replay.status, 201)
        assert.deepEqual(await replay.json(), receipt)
        assert.equal(
          await prisma.serviceRequest.count({
            where: { clientId: client.id, submissionKey: input.submissionKey },
          }),
          1,
        )
        const submittedList = await fetch(
          `${base}/service-requests?status=SUBMITTED`,
          { headers },
        )
        assert.equal(submittedList.status, 200)
        const list = (await submittedList.json()) as {
          serviceRequests: { status: string }[]
          total: number
        }
        assert.ok(list.total > 0)
        assert.ok(
          list.serviceRequests.every((row) => row.status === "SUBMITTED"),
        )
        const absentLegacy = await fetch(
          `${base}/service-requests?status=PENDING`,
          { headers },
        )
        assert.equal(absentLegacy.status, 400)
        await prisma.user.update({
          where: { id: client.id },
          data: { isActive: false },
        })
        assert.equal((await post()).status, 401)
        assert.equal(
          (await fetch(`${base}/service-requests`, { headers })).status,
          401,
        )
        assert.equal(
          (
            await fetch(
              `${base}/service-requests/${receipt.serviceRequest.id}`,
              { headers },
            )
          ).status,
          401,
        )
      },
    )
  },
)
