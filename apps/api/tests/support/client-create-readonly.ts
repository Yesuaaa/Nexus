import assert from "node:assert/strict"
import { test } from "node:test"
import * as catalog from "../../src/features/auth/auth.permissions.js"

test(
  "read-only Client authorization preserves reads and denies creation directly",
  { timeout: 90_000 },
  async (t) => {
    let readOnly = true
    t.mock.module(
      new URL("../../src/features/auth/auth.permissions.js", import.meta.url)
        .href,
      {
        namedExports: {
          ...catalog,
          hasPermission: (
            role: Parameters<typeof catalog.hasPermission>[0],
            permission: catalog.Permission,
          ) =>
            !(readOnly && permission === catalog.Permission.CLIENTS_CREATE) &&
            catalog.hasPermission(role, permission),
          permissionsFor: (
            role: Parameters<typeof catalog.permissionsFor>[0],
          ) =>
            catalog
              .permissionsFor(role)
              .filter(
                (permission) =>
                  !readOnly || permission !== catalog.Permission.CLIENTS_CREATE,
              ),
        },
      },
    )
    // Load real routers and auth after installing the isolated catalog override.
    const { startPgliteApp } = await import("./pglite-app.js")
    const { issueSession } =
      await import("../../src/features/auth/auth.service.js")
    const { prisma, base } = await startPgliteApp(t)
    const target = await prisma.user.create({
      data: {
        email: "target@create-permission.test",
        role: "USER",
        passwordHash: "test-only",
        fullName: "Existing Client",
      },
    })
    const input = {
      fullName: "Created Client",
      email: "created@create-permission.test",
      contactNumber: "09123456789",
      password: "ValidClientPassword123!",
      isActive: true,
      role: "SUPERADMIN",
    }
    const actors = []
    for (const role of ["ADMIN", "SUPERADMIN"] as const) {
      const user = await prisma.user.create({
        data: {
          email: `${role}@create-permission.test`,
          role,
          passwordHash: "test-only",
        },
      })
      const session = await issueSession(user)
      actors.push({
        user,
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      })
      assert.ok(session.user.permissions.includes("clients:read"))
      assert.ok(
        !session.user.permissions.includes(catalog.Permission.CLIENTS_CREATE),
      )
    }
    for (const actor of actors) {
      for (const path of [
        "/clients",
        `/clients/${target.id}`,
        `/clients/${target.id}/projects`,
        `/clients/${target.id}/service-requests`,
      ])
        assert.equal(
          (await fetch(`${base}${path}`, { headers: actor.headers })).status,
          200,
        )
      const count = await prisma.user.count()
      const response = await fetch(
        `${base}/clients?role=SUPERADMIN&permissions=clients:create`,
        {
          method: "POST",
          headers: { ...actor.headers, "x-permissions": "clients:create" },
          body: JSON.stringify(input),
        },
      )
      assert.equal(response.status, 403)
      assert.deepEqual(Object.keys((await response.json()) as object), [
        "error",
      ])
      assert.equal(await prisma.user.count(), count)
    }
    // Restore the normal catalog in this child: same endpoints and same sessions.
    readOnly = false
    for (const [index, actor] of actors.entries()) {
      const response = await fetch(`${base}/clients`, {
        method: "POST",
        headers: actor.headers,
        body: JSON.stringify({
          ...input,
          email: `created-${index}@create-permission.test`,
        }),
      })
      assert.equal(response.status, 201, await response.clone().text())
      const { client } = (await response.json()) as { client: { id: string } }
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: client.id } }))
          .role,
        "USER",
      )
    }
  },
)
