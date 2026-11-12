import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword } from "./features/auth/auth.password.js"
import { issueSession } from "./features/auth/auth.service.js"
import type { publicUser } from "./features/users/users.dto.js"
import { PASSWORD_POLICY_MESSAGE } from "./shared/password-policy.js"
import { safeHttpsUrl } from "./shared/validation.js"
import { startPgliteApp, testImageStorage } from "./test/pglite-app.js"

type PublicUser = ReturnType<typeof publicUser>

test("safeHttpsUrl only keeps credential-free HTTPS URLs", () => {
  assert.equal(
    safeHttpsUrl("https://cdn.example.com/a b.png"),
    "https://cdn.example.com/a%20b.png",
  )
  for (const value of [
    null,
    undefined,
    "",
    "http://cdn.example.com/avatar.png",
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    "data:image/png;base64,AAAA",
    "ftp://cdn.example.com/avatar.png",
    "https://user:secret@cdn.example.com/avatar.png",
    "//cdn.example.com/avatar.png",
    "not a url",
  ])
    assert.equal(safeHttpsUrl(value), null, String(value))
})

test(
  "account policy: strong new passwords, legacy logins, shared email rule and consistent user DTOs",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t, {
      imageStorage: testImageStorage,
    })
    const base = `${origin}/api`
    const api = (
      path: string,
      {
        method = "GET",
        token,
        body,
      }: {
        method?: string
        token?: string
        body?: unknown
      } = {},
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    const errorOf = async (response: Response) =>
      ((await response.json()) as { error: string }).error
    const weakPasswords = [
      "Short-1a",
      "a long lowercase passphrase",
      "NoDigitsOrSymbolsHere",
      "NoSymbols12345",
      "no-uppercase-12345",
    ]
    const strongPassword = "Strong-Password-123"

    const actorHash = await hashPassword("Actor-password-123!")
    const superadmin = await prisma.user.create({
      data: {
        email: "root@policy.example",
        fullName: "Root Admin",
        role: "SUPERADMIN",
        passwordHash: actorHash,
      },
    })
    const admin = await prisma.user.create({
      data: {
        email: "admin@policy.example",
        fullName: "Ops Admin",
        role: "ADMIN",
        passwordHash: actorHash,
      },
    })
    const superadminToken = (await issueSession(superadmin)).token
    const adminToken = (await issueSession(admin)).token
    const department = await prisma.department.create({
      data: { name: "Design", code: "DSN", color: "teal" },
    })

    await t.test(
      "registration rejects weak passwords with the shared policy message",
      async () => {
        const registration = {
          email: "new.client@policy.example",
          fullName: "New Client",
          contactNumber: "09123456789",
        }
        for (const password of weakPasswords) {
          const response = await api("/auth/register", {
            method: "POST",
            body: { ...registration, password },
          })
          assert.equal(response.status, 400, password)
          assert.equal(await errorOf(response), PASSWORD_POLICY_MESSAGE)
        }
        assert.equal(
          await prisma.user.count({ where: { email: registration.email } }),
          0,
        )
        const created = await api("/auth/register", {
          method: "POST",
          body: { ...registration, password: strongPassword },
        })
        assert.equal(created.status, 201)
      },
    )

    await t.test(
      "existing weak passwords still log in, but self change-password enforces the policy",
      async () => {
        const legacyPassword = "legacy"
        const legacy = await prisma.user.create({
          data: {
            email: "legacy@policy.example",
            fullName: "Legacy Client",
            passwordHash: await hashPassword(legacyPassword),
          },
        })
        const login = await api("/auth/login", {
          method: "POST",
          body: { email: legacy.email, password: legacyPassword },
        })
        assert.equal(login.status, 200)
        const { token } = (await login.json()) as { token: string }
        for (const newPassword of weakPasswords) {
          const response = await api("/auth/change-password", {
            method: "POST",
            token,
            body: { currentPassword: legacyPassword, newPassword },
          })
          assert.equal(response.status, 400, newPassword)
          assert.equal(await errorOf(response), PASSWORD_POLICY_MESSAGE)
        }
        const unchanged = await prisma.user.findUniqueOrThrow({
          where: { id: legacy.id },
        })
        assert.equal(unchanged.passwordHash, legacy.passwordHash)
        assert.equal(
          (
            await api("/auth/change-password", {
              method: "POST",
              token,
              body: {
                currentPassword: legacyPassword,
                newPassword: strongPassword,
              },
            })
          ).status,
          204,
        )
        assert.equal(
          (
            await api("/auth/login", {
              method: "POST",
              body: { email: legacy.email, password: strongPassword },
            })
          ).status,
          200,
        )
      },
    )

    await t.test(
      "account management and employee logins share the policy",
      async () => {
        const account = {
          email: "managed@policy.example",
          fullName: "Managed Client",
          role: "USER",
        }
        const weakAccount = await api("/users", {
          method: "POST",
          token: superadminToken,
          body: { ...account, password: weakPasswords[1] },
        })
        assert.equal(weakAccount.status, 400)
        assert.equal(await errorOf(weakAccount), PASSWORD_POLICY_MESSAGE)
        assert.equal(
          (
            await api("/users", {
              method: "POST",
              token: superadminToken,
              body: { ...account, password: strongPassword },
            })
          ).status,
          201,
        )
        const weakEmployee = await api("/employees", {
          method: "POST",
          token: adminToken,
          body: {
            employeeId: "EXP-WEAK",
            fullName: "Weak Password",
            email: "weak.employee@policy.example",
            contactNumber: "09123456789",
            position: "Designer",
            employmentType: "FULL_TIME",
            startDate: "2026-01-15T00:00:00.000Z",
            departmentId: department.id,
            teamId: null,
            password: weakPasswords[3],
          },
        })
        assert.equal(weakEmployee.status, 400)
        assert.equal(await errorOf(weakEmployee), PASSWORD_POLICY_MESSAGE)
      },
    )

    await t.test(
      "employee records accept emails on any valid domain",
      async () => {
        for (const [employeeId, email] of [
          ["EXP-IO", "Ana.Cruz@Studio.io"],
          ["EXP-ORG", "ben@nonprofit.org"],
        ] as const) {
          const response = await api("/employees", {
            method: "POST",
            token: adminToken,
            body: {
              employeeId,
              fullName: "Domain Tester",
              email,
              contactNumber: "09123456789",
              position: "Designer",
              employmentType: "FULL_TIME",
              startDate: "2026-01-15T00:00:00.000Z",
              departmentId: department.id,
              teamId: null,
              password: strongPassword,
            },
          })
          assert.equal(response.status, 201, await response.clone().text())
          const stored = await prisma.employee.findUniqueOrThrow({
            where: { employeeId },
            include: { user: { select: { email: true } } },
          })
          assert.equal(stored.email, email.toLowerCase())
          assert.equal(stored.user?.email, email.toLowerCase())
        }
      },
    )

    await t.test(
      "/me, login, profile and the users list agree on imageUrl and headOf",
      async () => {
        const password = "Staff-password-123!"
        const passwordHash = await hashPassword(password)
        const cases = [
          {
            email: "head@policy.example",
            profileImagePath: null,
            employeeImage: "https://cdn.example.com/head.png",
            expected: "https://cdn.example.com/head.png",
            heads: true,
          },
          {
            email: "insecure@policy.example",
            profileImagePath: null,
            employeeImage: "http://cdn.example.com/insecure.png",
            expected: null,
            heads: false,
          },
          {
            email: "uploaded@policy.example",
            profileImagePath: "avatars/uploaded.png",
            employeeImage: "https://cdn.example.com/ignored.png",
            expected: "https://images.example.com/avatars/uploaded.png",
            heads: false,
          },
        ]
        for (const [index, item] of cases.entries()) {
          const user = await prisma.user.create({
            data: {
              email: item.email,
              fullName: `Staff ${index}`,
              role: "STAFF",
              passwordHash,
              profileImagePath: item.profileImagePath,
              departmentId: department.id,
            },
          })
          await prisma.employee.create({
            data: {
              employeeId: `EXP-IMG-${index}`,
              fullName: `Staff ${index}`,
              email: item.email,
              userId: user.id,
              departmentId: department.id,
              profileImageUrl: item.employeeImage,
            },
          })
          if (item.heads)
            await prisma.department.update({
              where: { id: department.id },
              data: { headId: user.id },
            })

          const login = await api("/auth/login", {
            method: "POST",
            body: { email: item.email, password },
          })
          assert.equal(login.status, 200)
          const session = (await login.json()) as {
            token: string
            user: PublicUser
          }
          const me = (
            (await (
              await api("/auth/me", { token: session.token })
            ).json()) as {
              user: PublicUser
            }
          ).user
          const profileBody = (await (
            await api("/auth/profile", { token: session.token })
          ).json()) as { user: PublicUser; imageUrl: string | null }
          const profile = profileBody.user
          // The profile page's own avatar applies the same HTTPS-only rule.
          assert.equal(profileBody.imageUrl, item.expected, "profile imageUrl")
          const listed = (
            (await (
              await api(`/users?search=${encodeURIComponent(item.email)}`, {
                token: superadminToken,
              })
            ).json()) as { users: PublicUser[] }
          ).users.find((candidate) => candidate.id === user.id)
          assert.ok(listed, item.email)
          const expectedHead = item.heads
            ? { id: department.id, name: department.name }
            : null
          const expectedDepartment = {
            id: department.id,
            name: department.name,
            code: department.code,
            color: department.color,
          }
          for (const [source, dto] of Object.entries({
            login: session.user,
            me,
            profile,
            list: listed,
          })) {
            assert.equal(dto.imageUrl, item.expected, `${source} imageUrl`)
            assert.deepEqual(dto.headOf, expectedHead, `${source} headOf`)
            assert.deepEqual(
              dto.department,
              expectedDepartment,
              `${source} department`,
            )
          }
        }
      },
    )
  },
)
