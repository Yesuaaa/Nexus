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
        assert.equal(receipt.serviceRequest.status, "PENDING")
        const record = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: receipt.serviceRequest.id },
        })
        assert.equal(record.clientId, client.id)
        assert.equal(record.status, "PENDING")
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
        await prisma.user.update({
          where: { id: client.id },
          data: { isActive: false },
        })
        assert.equal((await post(input)).status, 401)
      },
    )
  },
)
