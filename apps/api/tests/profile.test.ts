import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { hashPassword } from "../src/features/auth/auth.password.js"
import type { getProfile } from "../src/features/auth/profile.service.js"
import type { User } from "../src/generated/prisma/client.js"
import {
  ServiceImageStorageError,
  setServiceImageStorageForTests,
} from "../src/features/services/service-image-storage.js"
import { startPgliteApp } from "./support/pglite-app.js"
type ProfileResponse = Awaited<ReturnType<typeof getProfile>>
const readProfile = async (response: Response) =>
  (await response.json()) as ProfileResponse

test(
  "self-service profiles isolate roles, synchronize employee data, and protect specialist edits",
  { timeout: 90000 },
  async (t) => {
    let imageUploads = 0
    const { prisma, origin } = await startPgliteApp(t, {
      imageStorage: {
        upload: async (_dataUrl, directory = "services") =>
          `${directory}/${++imageUploads}.png`,
        publicUrl: (path) => `https://images.example.com/${path}`,
        remove: async () => {},
      },
    })
    const base = `${origin}/api/auth`
    const request = (
      token: string,
      path: string,
      method = "GET",
      body?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const password = "Profile-password-123!"
    const passwordHash = await hashPassword(password)
    const actors = []
    for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const) {
      const user = await prisma.user.create({
        data: {
          role,
          fullName: `${role} Profile`,
          email: `${role.toLowerCase()}@profile.example`,
          passwordHash,
        },
      })
      actors.push({ user, token: (await issueSession(user)).token })
    }
    const staff = actors[1]!
    const employee = await prisma.employee.create({
      data: {
        userId: staff.user.id,
        employeeId: "EXP-PROFILE",
        fullName: staff.user.fullName!,
        email: staff.user.email,
      },
    })
    for (const { user, token } of actors) {
      const response = await request(token, "/profile")
      assert.equal(response.status, 200)
      const profile = await readProfile(response)
      assert.equal(profile.user.id, user.id)
      assert.equal("passwordHash" in profile.user, false)
      const saved = await request(token, "/profile", "PATCH", {
        fullName: `Updated ${user.role}`,
        contactNumber: "09123456789",
        role: "SUPERADMIN",
        email: "injected@invalid.example",
        userId: staff.user.id,
      })
      assert.equal(saved.status, 200)
      const persisted: User = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      })
      assert.equal(persisted.role, user.role)
      assert.equal(persisted.email, user.email)
      assert.equal(persisted.fullName, `Updated ${user.role}`)
    }
    assert.equal(
      (await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .fullName,
      "Updated STAFF",
    )
    const pngData =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lY4AAAAASUVORK5CYII="
    for (const actor of actors) {
      for (const kind of ["avatar", "banner"] as const) {
        const result = await request(actor.token, "/profile/images", "POST", {
          kind,
          dataUrl: pngData,
        })
        assert.equal(result.status, 201, await result.clone().text())
        const body = (await result.json()) as {
          url: string
          profile: { imageUrl: string; bannerUrl: string }
        }
        assert.match(
          body.url,
          new RegExp(`/profiles/${actor.user.id}/${kind}/`),
        )
        assert.equal(
          kind === "avatar" ? body.profile.imageUrl : body.profile.bannerUrl,
          body.url,
        )
      }
    }
    const managementBase = base.replace(/\/auth$/, "")
    const accountListResponse = await fetch(`${managementBase}/users`, {
      headers: { authorization: `Bearer ${actors[3]!.token}` },
    })
    assert.equal(accountListResponse.status, 200)
    const accountList = (await accountListResponse.json()) as {
      users: { id: string; imageUrl: string | null }[]
    }
    for (const actor of actors)
      assert.match(
        accountList.users.find((item) => item.id === actor.user.id)!.imageUrl!,
        new RegExp(`/profiles/${actor.user.id}/avatar/`),
      )
    const employeeListResponse = await fetch(`${managementBase}/employees`, {
      headers: { authorization: `Bearer ${actors[2]!.token}` },
    })
    assert.equal(employeeListResponse.status, 200)
    const employeeList = (await employeeListResponse.json()) as {
      employees: { accountId: string; imageUrl: string | null }[]
    }
    for (const actor of [actors[1]!, actors[2]!])
      assert.match(
        employeeList.employees.find((item) => item.accountId === actor.user.id)!
          .imageUrl!,
        new RegExp(`/profiles/${actor.user.id}/avatar/`),
      )
    const employeeDetailResponse = await fetch(
      `${managementBase}/employees/${employee.id}`,
      { headers: { authorization: `Bearer ${actors[2]!.token}` } },
    )
    assert.equal(employeeDetailResponse.status, 200)
    const employeeDetail = (await employeeDetailResponse.json()) as {
      employee: { imageUrl: string | null }
    }
    assert.match(
      employeeDetail.employee.imageUrl!,
      new RegExp(`/profiles/${staff.user.id}/avatar/`),
    )
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1)
    oversized.set([137, 80, 78, 71, 13, 10, 26, 10])
    for (const dataUrl of [
      `data:image/png;base64,${oversized.toString("base64")}`,
      "data:image/gif;base64,R0lGODlh",
      "data:image/png;base64,%%%",
    ])
      assert.equal(
        (
          await request(actors[0]!.token, "/profile/images", "POST", {
            kind: "avatar",
            dataUrl,
          })
        ).status,
        400,
      )
    setServiceImageStorageForTests({
      upload: async () => {
        throw new ServiceImageStorageError("private storage failure")
      },
      remove: async () => {},
      publicUrl: (path) => `https://images.example.com/${path}`,
    })
    const unavailable = await request(
      actors[0]!.token,
      "/profile/images",
      "POST",
      { kind: "avatar", dataUrl: pngData },
    )
    assert.equal(unavailable.status, 503)
    assert.equal(
      (await unavailable.text()).includes("private storage failure"),
      false,
    )
    setServiceImageStorageForTests({
      upload: async (_dataUrl, directory = "services") =>
        `${directory}/${++imageUploads}.png`,
      publicUrl: (path) => `https://images.example.com/${path}`,
      remove: async () => {},
    })
    const uploadsBeforeInvalid = imageUploads
    assert.equal(
      (
        await request(staff.token, "/profile/images", "POST", {
          kind: "avatar",
          dataUrl: "data:image/png;base64,aW52YWxpZA==",
        })
      ).status,
      400,
    )
    assert.equal(imageUploads, uploadsBeforeInvalid)
    assert.equal(
      (
        await request(actors[0]!.token, "/profile/images", "POST", {
          kind: "project",
          dataUrl: pngData,
        })
      ).status,
      403,
    )
    const projectImage = await request(staff.token, "/profile/images", "POST", {
      kind: "project",
      dataUrl: pngData,
    })
    assert.equal(projectImage.status, 201)
    const uploadedEmployee = await prisma.employee.findUniqueOrThrow({
      where: { id: employee.id },
    })
    assert.match(uploadedEmployee.profileImageUrl!, /\/avatar\//)
    assert.match(uploadedEmployee.profileBannerUrl!, /\/banner\//)
    const profile = await readProfile(await request(staff.token, "/profile"))
    const specialist = {
      ...profile.specialist,
      bio: "Building accessible products.",
      imageUrl: "https://example.com/avatar.jpg",
      specialties: ["Design", "Development"],
      socialLinks: [
        { platform: "LinkedIn", url: "https://linkedin.com/in/example" },
      ],
      projects: [
        {
          title: "Client website",
          summary: "An accessible website.",
          contribution: "Design and development",
          thumbnailUrl: "https://example.com/project.jpg",
          projectUrl: "https://example.com/project",
          isPublished: true,
        },
      ],
    }
    const saved = await request(
      staff.token,
      "/profile/specialist",
      "PUT",
      specialist,
    )
    assert.equal(saved.status, 200, await saved.clone().text())
    assert.equal(
      (await readProfile(saved)).specialist!.projects[0]!.isPublished,
      true,
    )
    assert.equal(
      (await request(staff.token, "/profile/specialist", "PUT", specialist))
        .status,
      409,
    )
    for (const actor of [actors[0]!, actors[2]!, actors[3]!])
      assert.equal(
        (await request(actor.token, "/profile/specialist", "PUT", specialist))
          .status,
        403,
      )
    const current = (await readProfile(await request(staff.token, "/profile")))
      .specialist!
    assert.equal(
      (
        await request(staff.token, "/profile/specialist", "PUT", {
          ...current,
          imageUrl: "javascript:alert(1)",
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await request(staff.token, "/profile/specialist", "PUT", {
          ...current,
          projects: Array(13).fill(specialist.projects[0]),
        })
      ).status,
      400,
    )
    const otherStaff = await prisma.user.create({
      data: { email: "unlinked@profile.example", role: "STAFF", passwordHash },
    })
    const unlinked = (await issueSession(otherStaff)).token
    assert.equal(
      (await request(unlinked, "/profile/specialist", "PUT", specialist))
        .status,
      409,
    )
    assert.equal(
      (
        await request(staff.token, "/profile", "PATCH", {
          fullName: "A",
          contactNumber: "bad",
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await request(staff.token, "/change-password", "POST", {
          currentPassword: "wrong-password",
          newPassword: "New-profile-password-123!",
        })
      ).status,
      400,
    )
    assert.equal((await request(staff.token, "/profile")).status, 200)
    const secondSession = await issueSession(staff.user)
    assert.equal(
      (
        await request(staff.token, "/change-password", "POST", {
          currentPassword: password,
          newPassword: "New-profile-password-123!",
        })
      ).status,
      204,
    )
    assert.equal((await request(staff.token, "/profile")).status, 200)
    assert.equal((await request(secondSession.token, "/profile")).status, 200)
  },
)
