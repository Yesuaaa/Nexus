import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword } from "../src/features/auth/auth.password.js"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { getProfile } from "../src/features/auth/profile.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

type ProfileResponse = Awaited<ReturnType<typeof getProfile>>

test(
  "Page 17 profile API validation, ownership, upload, and session boundaries",
  { timeout: 120000 },
  async (t) => {
    let imageUploads = 0
    const { prisma, base } = await startPgliteApp(t, {
      imageStorage: {
        upload: async (_dataUrl, directory = "services") =>
          `${directory}/page-17-${++imageUploads}.png`,
        publicUrl: (path) => `https://images.example.com/${path}`,
        remove: async () => {},
      },
    })
    const passwordHash = await hashPassword("Page-17-Password-123!")
    const self = await prisma.user.create({
      data: {
        email: "page-17-staff@example.test",
        fullName: "Original Staff",
        contactNumber: "09123456789",
        role: "STAFF",
        passwordHash,
      },
    })
    const foreign = await prisma.user.create({
      data: {
        email: "page-17-foreign@example.test",
        fullName: "Foreign Account",
        role: "ADMIN",
        passwordHash,
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "PAGE17-STAFF",
        fullName: self.fullName!,
        email: self.email,
        userId: self.id,
      },
    })
    const selfSession = await issueSession(self)
    const foreignBefore = await prisma.user.findUniqueOrThrow({
      where: { id: foreign.id },
    })

    const request = (
      path: string,
      token: string | undefined,
      method = "GET",
      body?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })

    await t.test(
      "self updates persist to the linked employee and ignore identity or privilege fields",
      async () => {
        const queried = await request(
          `/auth/profile?userId=${encodeURIComponent(foreign.id)}`,
          selfSession.token,
        )
        assert.equal(queried.status, 200)
        assert.equal(
          ((await queried.json()) as ProfileResponse).user.id,
          self.id,
        )

        const response = await request(
          "/auth/profile",
          selfSession.token,
          "PATCH",
          {
            fullName: "  Zoë O'Neil  ",
            contactNumber: " +09123456789 ",
            id: foreign.id,
            userId: foreign.id,
            email: foreign.email,
            role: "SUPERADMIN",
            isActive: false,
            accountDeletedAt: "2026-11-14T00:00:00.000Z",
            permissions: ["accounts:status-privileged"],
            passwordHash: "injected-password-hash",
            departmentId: "foreign-department",
            teamId: "foreign-team",
            employeeId: "FOREIGN-EMPLOYEE",
          },
        )
        assert.equal(response.status, 200, await response.clone().text())
        const saved = (await response.json()) as ProfileResponse
        assert.equal(saved.user.id, self.id)
        assert.equal(saved.user.fullName, "Zoë O'Neil")
        assert.equal(saved.user.contactNumber, "+09123456789")
        assert.equal(saved.user.role, "STAFF")
        assert.equal("passwordHash" in saved.user, false)
        assert.equal(JSON.stringify(saved).includes("refreshToken"), false)
        assert.equal(
          JSON.stringify(saved).includes("injected-password-hash"),
          false,
        )

        const selfAfter = await prisma.user.findUniqueOrThrow({
          where: { id: self.id },
        })
        assert.equal(selfAfter.fullName, "Zoë O'Neil")
        assert.equal(selfAfter.contactNumber, "+09123456789")
        assert.equal(selfAfter.email, self.email)
        assert.equal(selfAfter.role, "STAFF")
        assert.equal(selfAfter.isActive, true)
        assert.equal(selfAfter.accountDeletedAt, null)
        assert.equal(selfAfter.departmentId, null)
        assert.equal(selfAfter.teamId, null)
        assert.equal(selfAfter.passwordHash, passwordHash)
        const employeeAfter = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        assert.equal(employeeAfter.fullName, "Zoë O'Neil")
        assert.equal(employeeAfter.contactNumber, "+09123456789")

        const foreignAfter = await prisma.user.findUniqueOrThrow({
          where: { id: foreign.id },
        })
        assert.equal(foreignAfter.fullName, foreignBefore.fullName)
        assert.equal(foreignAfter.email, foreignBefore.email)
        assert.equal(foreignAfter.role, foreignBefore.role)
        assert.equal(foreignAfter.passwordHash, foreignBefore.passwordHash)
      },
    )

    await t.test(
      "personal name and contact validation preserves User and Employee on rejection and accepts exact boundaries",
      async () => {
        const userBefore = await prisma.user.findUniqueOrThrow({
          where: { id: self.id },
        })
        const employeeBefore = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        const invalidBodies: unknown[] = [
          null,
          [],
          {},
          { contactNumber: "09123456789" },
          { fullName: null, contactNumber: "09123456789" },
          { fullName: "   ", contactNumber: "09123456789" },
          { fullName: "A", contactNumber: "09123456789" },
          { fullName: "N".repeat(101), contactNumber: "09123456789" },
          { fullName: "A\u0000B", contactNumber: "09123456789" },
          { fullName: "Valid Name" },
          { fullName: "Valid Name", contactNumber: null },
          { fullName: "Valid Name", contactNumber: 9123456789 },
          { fullName: "Valid Name", contactNumber: "123456" },
          { fullName: "Valid Name", contactNumber: "٠١٢٣٤٥٦٧٨٩" },
          { fullName: "Valid Name", contactNumber: `+${"1".repeat(21)}` },
        ]
        for (const [index, body] of invalidBodies.entries()) {
          const response = await request(
            "/auth/profile",
            selfSession.token,
            "PATCH",
            body,
          )
          assert.equal(
            response.status,
            400,
            `invalid profile input ${index + 1}: ${await response.text()}`,
          )
        }
        assert.deepEqual(
          await prisma.user.findUniqueOrThrow({ where: { id: self.id } }),
          userBefore,
        )
        assert.deepEqual(
          await prisma.employee.findUniqueOrThrow({
            where: { id: employee.id },
          }),
          employeeBefore,
        )

        const validBoundaries = [
          { fullName: "Jo", contactNumber: "1234567" },
          { fullName: "N".repeat(100), contactNumber: `+${"1".repeat(20)}` },
          {
            fullName: '  <script>alert("profile")</script>  ',
            contactNumber: "09123456789",
          },
          { fullName: "  Ana García  ", contactNumber: "   " },
        ]
        for (const body of validBoundaries) {
          const response = await request(
            "/auth/profile",
            selfSession.token,
            "PATCH",
            body,
          )
          assert.equal(response.status, 200, await response.clone().text())
          const saved = (await response.json()) as ProfileResponse
          assert.equal(saved.user.fullName, body.fullName.trim())
          assert.equal(
            saved.user.contactNumber,
            body.contactNumber.trim() || null,
          )
        }
        const finalEmployee = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        assert.equal(finalEmployee.fullName, "Ana García")
        assert.equal(finalEmployee.contactNumber, null)
      },
    )

    await t.test(
      "specialist profile accepts documented maxima and rejects every over-limit collection field",
      async () => {
        const loaded = await request("/auth/profile", selfSession.token)
        assert.equal(loaded.status, 200)
        const current = (await loaded.json()) as ProfileResponse
        assert.ok(current.specialist)

        const urlPrefix = "https://example.test/"
        const maxUrl = `${urlPrefix}${"x".repeat(2048 - urlPrefix.length)}`
        const maximum = {
          bio: "B".repeat(2000),
          imageUrl: "",
          specialties: Array.from(
            { length: 20 },
            (_, index) => `Skill ${index}`,
          ),
          updatedAt: current.specialist.updatedAt,
          socialLinks: [{ platform: "P".repeat(40), url: maxUrl }],
          projects: [
            {
              title: "T".repeat(160),
              summary: "S".repeat(3000),
              contribution: "C".repeat(2000),
              thumbnailUrl: maxUrl,
              projectUrl: maxUrl,
              isPublished: true,
            },
          ],
        }
        assert.equal(maxUrl.length, 2048)
        const accepted = await request(
          "/auth/profile/specialist",
          selfSession.token,
          "PUT",
          maximum,
        )
        assert.equal(accepted.status, 200, await accepted.clone().text())
        const acceptedProfile = (await accepted.json()) as ProfileResponse
        assert.equal(acceptedProfile.specialist?.bio.length, 2000)
        assert.equal(acceptedProfile.specialist?.specialties.length, 20)
        assert.equal(
          acceptedProfile.specialist?.socialLinks[0]?.platform.length,
          40,
        )
        assert.equal(
          acceptedProfile.specialist?.socialLinks[0]?.url.length,
          2048,
        )
        assert.equal(acceptedProfile.specialist?.projects[0]?.title.length, 160)
        assert.equal(
          acceptedProfile.specialist?.projects[0]?.summary.length,
          3000,
        )
        assert.equal(
          acceptedProfile.specialist?.projects[0]?.contribution.length,
          2000,
        )

        const firstProject = maximum.projects[0]
        const invalidBodies: unknown[] = [
          { ...maximum, bio: "B".repeat(2001) },
          { ...maximum, imageUrl: maxUrl + "x" },
          { ...maximum, specialties: Array(21).fill("Skill") },
          { ...maximum, specialties: ["S".repeat(81)] },
          {
            ...maximum,
            socialLinks: Array(11).fill({
              platform: "Website",
              url: "https://example.test",
            }),
          },
          {
            ...maximum,
            socialLinks: [
              { platform: "P".repeat(41), url: "https://example.test" },
            ],
          },
          {
            ...maximum,
            socialLinks: [{ platform: "Website", url: maxUrl + "x" }],
          },
          { ...maximum, projects: Array(13).fill(firstProject) },
          {
            ...maximum,
            projects: [{ ...firstProject, title: "T".repeat(161) }],
          },
          {
            ...maximum,
            projects: [{ ...firstProject, summary: "S".repeat(3001) }],
          },
          {
            ...maximum,
            projects: [{ ...firstProject, contribution: "C".repeat(2001) }],
          },
          {
            ...maximum,
            projects: [{ ...firstProject, thumbnailUrl: maxUrl + "x" }],
          },
          {
            ...maximum,
            projects: [{ ...firstProject, projectUrl: maxUrl + "x" }],
          },
          {
            ...maximum,
            projects: [{ ...firstProject, isPublished: "true" }],
          },
        ]
        for (const [index, body] of invalidBodies.entries()) {
          const response = await request(
            "/auth/profile/specialist",
            selfSession.token,
            "PUT",
            body,
          )
          assert.equal(
            response.status,
            400,
            `invalid specialist input ${index + 1}: ${await response.text()}`,
          )
        }

        const employeeAfter = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        assert.equal(employeeAfter.profileBio, maximum.bio)
        assert.equal(employeeAfter.profileSpecialties.length, 20)
        const links = await prisma.specialistSocialLink.findMany({
          where: { employeeId: employee.id },
        })
        assert.equal(links.length, 1)
        assert.equal(links[0]?.platform.length, 40)
        assert.equal(links[0]?.url.length, 2048)
        const projects = await prisma.specialistPortfolioProject.findMany({
          where: { employeeId: employee.id },
        })
        assert.equal(projects.length, 1)
        assert.equal(projects[0]?.title.length, 160)
        assert.equal(projects[0]?.summary.length, 3000)
        assert.equal(projects[0]?.contribution?.length, 2000)
      },
    )

    await t.test(
      "server accepts a 2 MiB image and rejects oversized bytes before storage",
      async () => {
        const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        const exactLimit = Buffer.alloc(2 * 1024 * 1024)
        signature.copy(exactLimit)
        const dataUrl = `data:image/png;base64,${exactLimit.toString("base64")}`
        const accepted = await request(
          "/auth/profile/images",
          selfSession.token,
          "POST",
          { kind: "avatar", dataUrl },
        )
        assert.equal(accepted.status, 201, await accepted.clone().text())
        const acceptedBody = (await accepted.json()) as {
          url: string
          profile: ProfileResponse | null
        }
        assert.equal(imageUploads, 1)
        assert.equal(
          acceptedBody.profile?.imageUrl,
          "https://images.example.com/profiles/" +
            `${self.id}/avatar/page-17-1.png`,
        )

        const tooLarge = Buffer.alloc(2 * 1024 * 1024 + 1)
        signature.copy(tooLarge)
        const rejected = await request(
          "/auth/profile/images",
          selfSession.token,
          "POST",
          {
            kind: "avatar",
            dataUrl: `data:image/png;base64,${tooLarge.toString("base64")}`,
          },
        )
        assert.equal(rejected.status, 400, await rejected.clone().text())
        assert.equal(imageUploads, 1)
      },
    )

    await t.test(
      "specialist URLs whose Unicode normalization exceeds the database limit are rejected as validation errors",
      async () => {
        const response = await request("/auth/profile", selfSession.token)
        assert.equal(response.status, 200)
        const profile = (await response.json()) as ProfileResponse
        assert.ok(profile.specialist)

        const prefix = "https://example.test/"
        const unicodeUrl = `${prefix}${"é".repeat(2048 - prefix.length)}`
        assert.equal(unicodeUrl.length, 2048)
        assert.ok(new URL(unicodeUrl).href.length > 2048)

        const employeeBefore = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        const linksBefore = await prisma.specialistSocialLink.findMany({
          where: { employeeId: employee.id },
          orderBy: { displayOrder: "asc" },
        })
        const saved = await request(
          "/auth/profile/specialist",
          selfSession.token,
          "PUT",
          {
            ...profile.specialist,
            socialLinks: [{ platform: "Portfolio", url: unicodeUrl }],
          },
        )
        const errorBody = await saved.text()
        const employeeAfter = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        const linksAfter = await prisma.specialistSocialLink.findMany({
          where: { employeeId: employee.id },
          orderBy: { displayOrder: "asc" },
        })
        assert.deepEqual(employeeAfter, employeeBefore)
        assert.deepEqual(linksAfter, linksBefore)
        assert.equal(saved.status, 400, errorBody)
      },
    )

    await t.test(
      "anonymous, malformed, inactive, deleted, and expired sessions cannot read or update a profile",
      async () => {
        assert.equal((await request("/auth/profile", undefined)).status, 401)
        assert.equal(
          (await request("/auth/profile", "malformed-token")).status,
          401,
        )

        const inactive = await prisma.user.create({
          data: {
            email: "page-17-inactive@example.test",
            fullName: "Inactive Account",
            passwordHash,
          },
        })
        const inactiveToken = (await issueSession(inactive)).token
        await prisma.user.update({
          where: { id: inactive.id },
          data: { isActive: false },
        })
        assert.equal(
          (await request("/auth/profile", inactiveToken)).status,
          401,
        )
        const rejectedUpdate = await request(
          "/auth/profile",
          inactiveToken,
          "PATCH",
          { fullName: "Unauthorized Update", contactNumber: "09123456789" },
        )
        assert.equal(rejectedUpdate.status, 401)
        assert.equal(
          (await prisma.user.findUniqueOrThrow({ where: { id: inactive.id } }))
            .fullName,
          "Inactive Account",
        )

        const deleted = await prisma.user.create({
          data: {
            email: "page-17-deleted@example.test",
            fullName: "Deleted Account",
            passwordHash,
          },
        })
        const deletedToken = (await issueSession(deleted)).token
        await prisma.user.update({
          where: { id: deleted.id },
          data: { accountDeletedAt: new Date() },
        })
        assert.equal((await request("/auth/profile", deletedToken)).status, 401)

        const expired = await prisma.user.create({
          data: {
            email: "page-17-expired@example.test",
            fullName: "Expired Session",
            passwordHash,
          },
        })
        const expiredToken = (await issueSession(expired)).token
        const session = await prisma.session.findFirstOrThrow({
          where: { userId: expired.id },
        })
        await prisma.session.update({
          where: { id: session.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        })
        assert.equal((await request("/auth/profile", expiredToken)).status, 401)
      },
    )
  },
)
