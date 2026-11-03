import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../app.js"
import { getPrisma } from "../../lib/db.js"
import { hashPassword } from "../auth/auth.password.js"
import { issueSession } from "../auth/auth.service.js"
import { Role } from "../../generated/prisma/client.js"

test(
  "client services catalog, tiered packages, and specialist contracts are hardened and isolated",
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

    // Seed Roles and test sessions
    const dummyPasswordHash = await hashPassword("ValidPassword123!")
    const clientUser = await prisma.user.create({
      data: {
        email: "mobile.client@nexus.com",
        fullName: "Mobile Client",
        passwordHash: dummyPasswordHash,
        role: Role.USER,
        isActive: true,
      },
    })
    const staffUser = await prisma.user.create({
      data: {
        email: "mobile.staff@nexus.com",
        fullName: "Mobile Staff",
        passwordHash: dummyPasswordHash,
        role: Role.STAFF,
        isActive: true,
      },
    })
    const adminUser = await prisma.user.create({
      data: {
        email: "mobile.admin@nexus.com",
        fullName: "Mobile Admin",
        passwordHash: dummyPasswordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    })

    const clientSession = await issueSession(clientUser)
    const staffSession = await issueSession(staffUser)
    const adminSession = await issueSession(adminUser)

    // Seed Department
    const itDepartment = await prisma.department.create({
      data: {
        name: "Information Technology",
        code: "IT",
        color: "blue",
        description: "IT Department",
      },
    })

    const marketingDepartment = await prisma.department.create({
      data: {
        name: "Marketing",
        code: "MKT",
        color: "green",
        description: "Marketing Department",
      },
    })

    // Seed Active Service with Packages and Benefits
    const activeService = await prisma.service.create({
      data: {
        name: "Website Design & Development",
        description: "High performance responsive web platforms",
        iconKey: "code",
        isActive: true,
        departments: { connect: [{ id: itDepartment.id }] },
        packages: {
          create: [
            {
              name: "Starter Web",
              description: "Single page landing website",
              includedFeatures: ["1 Page", "Responsive"],
              pricingModel: "FIXED",
              currency: "PHP",
              amount: 15000,
              isPricingPublic: true,
              isActive: true,
              displayOrder: 1,
            },
            {
              name: "Private Tier",
              description: "Confidential package with masked pricing",
              includedFeatures: ["Custom Consulting"],
              pricingModel: "CUSTOM_QUOTE",
              currency: "PHP",
              amount: 99000,
              isPricingPublic: false,
              isActive: true,
              displayOrder: 2,
            },
            {
              name: "Discontinued Tier",
              description: "Inactive legacy tier",
              includedFeatures: ["Legacy Feature"],
              pricingModel: "FIXED",
              currency: "PHP",
              amount: 5000,
              isPricingPublic: true,
              isActive: false,
              displayOrder: 3,
            },
          ],
        },
        keyBenefits: {
          create: [
            {
              title: "Blazing Speed",
              description: "Optimized Core Web Vitals",
              displayOrder: 1,
            },
          ],
        },
      },
      include: { packages: true, departments: true },
    })

    // Seed Inactive Service
    const inactiveService = await prisma.service.create({
      data: {
        name: "Deprecated Service",
        description: "This service is turned off",
        iconKey: "sparkles",
        isActive: false,
        departments: { connect: [{ id: itDepartment.id }] },
      },
    })

    // Seed Specialists for IT Department
    // 1. Eligible active specialist
    const activeSpecialistUser = await prisma.user.create({
      data: {
        email: "alex.specialist@nexus.com",
        fullName: "Alex Rivera",
        passwordHash: dummyPasswordHash,
        role: Role.STAFF,
        isActive: true,
        departmentId: itDepartment.id,
      },
    })
    const activeEmployee = await prisma.employee.create({
      data: {
        employeeId: "EMP-IT-001",
        fullName: "Alex Rivera",
        email: "alex.specialist@nexus.com",
        position: "Senior Full-Stack Specialist",
        status: "ACTIVE",
        departmentId: itDepartment.id,
        userId: activeSpecialistUser.id,
        profileBio: "Experienced full stack developer",
        profileSpecialties: ["React", "KMP"],
        profileImageUrl: "https://example.com/avatar.png",
      },
    })

    // 2. Inactive employee status (ON_LEAVE)
    const onLeaveSpecialistUser = await prisma.user.create({
      data: {
        email: "leave.specialist@nexus.com",
        fullName: "Leave Specialist",
        passwordHash: dummyPasswordHash,
        role: Role.STAFF,
        isActive: true,
        departmentId: itDepartment.id,
      },
    })
    await prisma.employee.create({
      data: {
        employeeId: "EMP-IT-002",
        fullName: "Leave Specialist",
        email: "leave.specialist@nexus.com",
        position: "Junior Developer",
        status: "ON_LEAVE",
        departmentId: itDepartment.id,
        userId: onLeaveSpecialistUser.id,
      },
    })

    // 3. Specialist in a different department (Marketing)
    const mktSpecialistUser = await prisma.user.create({
      data: {
        email: "sophia.mkt@nexus.com",
        fullName: "Sophia Chen",
        passwordHash: dummyPasswordHash,
        role: Role.STAFF,
        isActive: true,
        departmentId: marketingDepartment.id,
      },
    })
    await prisma.employee.create({
      data: {
        employeeId: "EMP-MKT-001",
        fullName: "Sophia Chen",
        email: "sophia.mkt@nexus.com",
        position: "Growth Lead",
        status: "ACTIVE",
        departmentId: marketingDepartment.id,
        userId: mktSpecialistUser.id,
      },
    })

    // 4. Soft-deleted / deactivated user
    const deactivatedUser = await prisma.user.create({
      data: {
        email: "deactivated.staff@nexus.com",
        fullName: "Deactivated Staff",
        passwordHash: dummyPasswordHash,
        role: Role.STAFF,
        isActive: false,
        departmentId: itDepartment.id,
      },
    })
    await prisma.employee.create({
      data: {
        employeeId: "EMP-IT-003",
        fullName: "Deactivated Staff",
        email: "deactivated.staff@nexus.com",
        position: "Engineer",
        status: "ACTIVE",
        departmentId: itDepartment.id,
        userId: deactivatedUser.id,
      },
    })

    // --- TEST 1: Authentication and RBAC ---
    // Unauthenticated request should fail with 401
    const unauthResponse = await fetch(`${base}/services`)
    assert.equal(unauthResponse.status, 401)

    // STAFF or ADMIN should fail with 403 (Client routes require Role.USER)
    const staffResponse = await fetch(`${base}/services`, {
      headers: { Authorization: `Bearer ${staffSession.token}` },
    })
    assert.equal(staffResponse.status, 403)

    const adminResponse = await fetch(`${base}/services`, {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    })
    assert.equal(adminResponse.status, 403)

    // Authenticated USER receives 200 OK
    const clientResponse = await fetch(`${base}/services`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
    })
    assert.equal(clientResponse.status, 200)
    const catalog = (await clientResponse.json()) as {
      services: Array<{
        id: string
        name: string
        iconKey: string
        packages: Array<{
          id: string
          name: string
          amount: string | null
          billingInterval: string | null
          isPricingPublic: boolean
          isActive: boolean
        }>
        keyBenefits: Array<{ title: string }>
        departments: Array<{ code: string }>
      }>
    }

    // --- TEST 2: Active Services and Packages Filtering ---
    // The active service should be present, but the inactive service must NOT be listed
    assert.equal(catalog.services.length, 1)
    const serviceResult = catalog.services[0]!
    assert.equal(serviceResult.id, activeService.id)
    assert.equal(serviceResult.name, "Website Design & Development")
    assert.equal(serviceResult.iconKey, "code")
    assert.equal(serviceResult.departments[0]?.code, "IT")
    assert.equal(serviceResult.keyBenefits[0]?.title, "Blazing Speed")

    // Inactive packages (Discontinued Tier) must NOT be returned
    const packageNames = serviceResult.packages.map((p) => p.name)
    assert.ok(packageNames.includes("Starter Web"))
    assert.ok(packageNames.includes("Private Tier"))
    assert.ok(!packageNames.includes("Discontinued Tier"))

    // Public package shows amount, private package masks amount as null
    const starterPkg = serviceResult.packages.find(
      (p) => p.name === "Starter Web",
    )!
    assert.equal(starterPkg.isPricingPublic, true)
    assert.equal(starterPkg.amount, "15000")

    const privatePkg = serviceResult.packages.find(
      (p) => p.name === "Private Tier",
    )!
    assert.equal(privatePkg.isPricingPublic, false)
    assert.equal(privatePkg.amount, null)
    assert.equal(privatePkg.billingInterval, null)

    // --- TEST 3: Single Service Details (GET /services/:id) ---
    const detailResponse = await fetch(`${base}/services/${activeService.id}`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
    })
    assert.equal(detailResponse.status, 200)
    const detailJson = (await detailResponse.json()) as {
      service: { id: string; name: string }
    }
    assert.equal(detailJson.service.id, activeService.id)

    // Inactive service details should return 404
    const inactiveDetailResponse = await fetch(
      `${base}/services/${inactiveService.id}`,
      { headers: { Authorization: `Bearer ${clientSession.token}` } },
    )
    assert.equal(inactiveDetailResponse.status, 404)

    // Non-existent service ID should return 404
    const notFoundDetailResponse = await fetch(
      `${base}/services/nonexistent-id`,
      {
        headers: { Authorization: `Bearer ${clientSession.token}` },
      },
    )
    assert.equal(notFoundDetailResponse.status, 404)

    // --- TEST 4: Specialists Scoping & Active Enforcement ---
    const specialistsResponse = await fetch(
      `${base}/services/${activeService.id}/specialists`,
      { headers: { Authorization: `Bearer ${clientSession.token}` } },
    )
    assert.equal(specialistsResponse.status, 200)
    const specialistsJson = (await specialistsResponse.json()) as {
      specialists: Array<{
        id: string
        fullName: string
        position: string
        imageUrl: string | null
        department: { name: string }
      }>
    }

    // Only Alex Rivera (ACTIVE status, IT department, ACTIVE staff user) should be returned
    assert.equal(specialistsJson.specialists.length, 1)
    const specialist = specialistsJson.specialists[0]!
    assert.equal(specialist.id, activeEmployee.id)
    assert.equal(specialist.fullName, "Alex Rivera")
    assert.equal(specialist.position, "Senior Full-Stack Specialist")
    assert.equal(specialist.department.name, "Information Technology")
    assert.equal(specialist.imageUrl, "https://example.com/avatar.png")

    // Inactive service specialists returns 404
    const inactiveSpecialistsResponse = await fetch(
      `${base}/services/${inactiveService.id}/specialists`,
      { headers: { Authorization: `Bearer ${clientSession.token}` } },
    )
    assert.equal(inactiveSpecialistsResponse.status, 404)
  },
)
