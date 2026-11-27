import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "showcase order is atomic, authorized, and controls public order",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function auth(role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `reorder-${role}@test.local`,
          role,
          passwordHash: "unused",
        },
      })
      return {
        Authorization: `Bearer ${(await issueSession(user)).token}`,
        "Content-Type": "application/json",
      }
    }
    const headers = await auth(Role.SUPERADMIN)
    const admin = await auth(Role.ADMIN)
    const url = `${base}/project-showcase`
    const list = (await (await fetch(url, { headers })).json()) as {
      projects: { id: string; version: number; slug: string }[]
    }
    const order = [...list.projects]
      .reverse()
      .map(({ id, version }) => ({ id, version }))
    const reorder = (projects: typeof order, authorization = headers) =>
      fetch(`${url}/reorder`, {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ projects }),
      })
    assert.equal((await reorder(order, admin)).status, 403)
    assert.equal((await reorder(order.slice(1))).status, 409)
    assert.equal((await reorder([...order, order[0]!])).status, 400)
    assert.equal((await reorder(order)).status, 200)
    assert.equal((await reorder(order)).status, 409)
    const after = (await (await fetch(url, { headers })).json()) as typeof list
    assert.deepEqual(
      after.projects.map(({ id }) => id),
      order.map(({ id }) => id),
    )
    const publicProjects = (await (
      await fetch(`${base}/public/projects`)
    ).json()) as { projects: { slug: string }[] }
    assert.deepEqual(
      publicProjects.projects.map(({ slug }) => slug),
      [...list.projects].reverse().map(({ slug }) => slug),
    )
  },
)

test(
  "showcase publication, homepage selection, and edits require Administration access",
  { timeout: 120_000 },
  async (t) => {
    const uploads: string[] = []
    const removed: string[] = []
    const { prisma, base } = await startPgliteApp(t, {
      imageStorage: {
        upload: async () => {
          const path = `project-showcase/image-${uploads.length}.webp`
          uploads.push(path)
          return path
        },
        publicUrl: (path) =>
          `https://demo.supabase.co/storage/v1/object/public/${path}`,
        remove: async (path) => {
          removed.push(path)
        },
      },
    })
    async function headersFor(role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}@showcase.test`,
          role,
          passwordHash: "unused",
        },
      })
      return {
        Authorization: `Bearer ${(await issueSession(user)).token}`,
        "Content-Type": "application/json",
      }
    }
    const management = base + "/project-showcase"
    await prisma.service.create({
      data: { name: "Branding", description: "Test service" },
    })
    const publicList = base + "/public/projects"
    const headers = await headersFor(Role.SUPERADMIN)
    const admin = await headersFor(Role.ADMIN)
    const input = {
      slug: "studio-rebrand",
      name: "Studio Rebrand",
      client: "Demo Studio",
      type: "Branding",
      year: 2026,
      description: "A new visual identity for the studio.",
      image: "/landing/converyn-team-design.webp",
      galleryLayout: "five-lead-left",
      additionalImages: [
        "/landing/converyn-product-discover.webp",
        "/landing/converyn-product-create.webp",
        "/landing/converyn-product-connect.webp",
        "https://demo.supabase.co/storage/v1/object/public/projects/detail.webp",
      ],
      position: 0,
      featured: true,
      fictional: true,
      published: false,
    }
    const create = (auth: typeof headers, data = input) =>
      fetch(management, {
        method: "POST",
        headers: auth,
        body: JSON.stringify(data),
      })
    assert.equal((await fetch(management)).status, 401)
    assert.equal((await fetch(management, { headers: admin })).status, 403)
    assert.equal((await create(admin)).status, 403)
    assert.equal(
      (await create(headers, { ...input, type: "Unknown service" })).status,
      400,
    )
    assert.equal(
      (await create(headers, { ...input, image: "/api/private.png" })).status,
      400,
    )
    assert.equal(
      (await create(headers, { ...input, galleryLayout: "unknown" })).status,
      400,
    )
    assert.equal(
      (await create(headers, { ...input, additionalImages: [] })).status,
      400,
    )
    assert.equal(
      (
        await create(headers, {
          ...input,
          additionalImages: [...input.additionalImages, input.image],
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await create(headers, {
          ...input,
          additionalImages: [
            "/api/private.png",
            ...input.additionalImages.slice(1),
          ],
        })
      ).status,
      400,
    )
    const created = await create(headers)
    assert.equal(created.status, 201)
    const { project: draft } = (await created.json()) as {
      project: { id: string; version: number }
    }
    assert.equal((await create(headers)).status, 409)
    assert.equal((await fetch(publicList + "/" + input.slug)).status, 404)

    const update = (published: boolean, version: number, auth = headers) =>
      fetch(management + "/" + draft.id, {
        method: "PATCH",
        headers: auth,
        body: JSON.stringify({ ...input, published, version }),
      })
    assert.equal((await update(true, draft.version, admin)).status, 403)
    assert.equal((await update(true, draft.version)).status, 200)
    assert.equal((await update(false, draft.version)).status, 409)
    const homepage = await fetch(publicList + "?placement=homepage")
    const { projects } = (await homepage.json()) as {
      projects: Record<string, unknown>[]
    }
    assert.deepEqual(
      projects.map((project) => project.slug),
      [input.slug, "jollybee", "mang-inasalan"],
    )
    for (const field of [
      "id",
      "published",
      "featured",
      "version",
      "description",
      "galleryLayout",
      "additionalImages",
    ]) {
      assert.ok(!(field in projects[0]!))
    }
    const detail = await fetch(publicList + "/" + input.slug)
    const { project } = (await detail.json()) as {
      project: Record<string, unknown>
    }
    assert.equal(project.year, input.year)
    assert.equal(project.description, input.description)
    assert.equal(project.galleryLayout, input.galleryLayout)
    assert.deepEqual(project.additionalImages, input.additionalImages)
    const existing = await fetch(publicList + "/jollybee")
    const { project: existingProject } = (await existing.json()) as {
      project: Record<string, unknown>
    }
    assert.equal(existingProject.galleryLayout, "single-wide")
    assert.deepEqual(existingProject.additionalImages, [])
    assert.equal((await update(false, draft.version + 1)).status, 200)
    assert.equal((await fetch(publicList + "/" + input.slug)).status, 404)
    const transition = (action: string, version: number, auth = headers) =>
      fetch(
        `${management}/${draft.id}${action === "delete" ? "" : "/" + action}`,
        {
          method: action === "delete" ? "DELETE" : "POST",
          headers: auth,
          body: JSON.stringify({ version }),
        },
      )
    assert.equal((await transition("delete", 2)).status, 409)
    assert.equal((await transition("archive", 2, admin)).status, 403)
    assert.equal((await transition("archive", 2)).status, 200)
    assert.equal((await update(true, 3)).status, 409)
    const archivedList = await fetch(management + "?archived=true", { headers })
    const archivedBody = (await archivedList.json()) as {
      projects: { id: string }[]
    }
    assert.ok(archivedBody.projects.some((item) => item.id === draft.id))
    assert.equal((await transition("restore", 3)).status, 200)
    assert.equal((await fetch(publicList + "/" + input.slug)).status, 404)
    assert.equal((await transition("archive", 4)).status, 200)
    assert.equal((await transition("delete", 4)).status, 409)
    assert.equal((await transition("delete", 5)).status, 204)

    const imageData =
      "data:image/webp;base64," + Buffer.from("RIFF0000WEBP").toString("base64")
    const uploaded = await create(headers, {
      ...input,
      slug: "uploaded",
      image: imageData,
      additionalImages: [imageData, ...input.additionalImages.slice(1)],
    })
    assert.equal(uploaded.status, 201)
    const uploadedBody = (await uploaded.json()) as {
      project: { image: string; additionalImages: string[] }
    }
    assert.match(uploadedBody.project.image, /^https:\/\/demo\.supabase\.co\//)
    assert.match(
      uploadedBody.project.additionalImages[0]!,
      /^https:\/\/demo\.supabase\.co\//,
    )
    assert.equal(uploads.length, 2)
    assert.equal(
      (
        await create(headers, {
          ...input,
          slug: "failed",
          image: imageData,
          galleryLayout: "unknown",
        })
      ).status,
      400,
    )
    assert.deepEqual(removed, [uploads[2]])
  },
)
