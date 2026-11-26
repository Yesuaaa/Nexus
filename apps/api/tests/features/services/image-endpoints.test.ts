import assert from "node:assert/strict"
import { test } from "node:test"
import sharp from "sharp"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { ServiceImageStorageError } from "../../../src/features/services/service-image-storage.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "service image endpoints enforce RBAC, WebP normalization, negative inputs, and storage cleanup",
  { timeout: 120_000 },
  async (t) => {
    let legacyUploadCalls = 0
    let uploadSequence = 0
    let failNextUpload = false
    const storedObjects = new Map<string, Buffer>()
    const removedPaths: string[] = []

    const { prisma, base } = await startPgliteApp(t, {
      imageStorage: {
        async upload() {
          legacyUploadCalls += 1
          throw new Error("Service endpoints must only write normalized WebP")
        },
        async uploadWebp(data, directory = "services") {
          if (failNextUpload) {
            failNextUpload = false
            throw new ServiceImageStorageError(
              "The service image could not be uploaded. Please try again.",
            )
          }
          assert.equal(data.subarray(0, 4).toString(), "RIFF")
          assert.equal(data.subarray(8, 12).toString(), "WEBP")
          const path = `${directory}/svc-img-${++uploadSequence}.webp`
          storedObjects.set(path, data)
          return path
        },
        async remove(path) {
          removedPaths.push(path)
          storedObjects.delete(path)
        },
        publicUrl(path) {
          return `https://images.example.com/${path}`
        },
      },
    })

    const department = await prisma.department.create({
      data: { name: "Creative Services", code: "CRV" },
    })

    const actors = new Map<
      "USER" | "STAFF" | "ADMIN" | "SUPERADMIN",
      { id: string; token: string }
    >()
    for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const) {
      const user = await prisma.user.create({
        data: {
          email: `svc-img-${role.toLowerCase()}@example.test`,
          fullName: `${role} Actor`,
          role,
          passwordHash: "unused-test-hash",
        },
      })
      if (role === "STAFF") {
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: user.id },
        })
      }
      actors.set(role, {
        id: user.id,
        token: (await issueSession(user)).token,
      })
    }

    async function makeDataUrl(
      format: "jpeg" | "png" | "webp",
      width = 16,
      height = 12,
    ) {
      const img = sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 22, g: 58, b: 112, alpha: 0.8 },
        },
      })
      const buffer =
        format === "jpeg"
          ? await img.jpeg().toBuffer()
          : format === "png"
            ? await img.png().toBuffer()
            : await img.webp().toBuffer()
      return `data:image/${format};base64,${buffer.toString("base64")}`
    }

    const request = (
      path: string,
      token: string | undefined,
      method: string,
      body?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

    const baseService = {
      description: "Normalized service image coverage",
      departmentIds: [department.id],
      isActive: true,
    }

    await t.test(
      "blocks unauthenticated, USER, and STAFF image mutations before storage",
      async () => {
        const pngUrl = await makeDataUrl("png")
        const payload = {
          ...baseService,
          name: "Unauthorized Service",
          imageDataUrl: pngUrl,
          imageAltText: "Unauthorized upload attempt",
        }
        assert.equal(
          (await request("/services", undefined, "POST", payload)).status,
          401,
        )
        for (const role of ["USER", "STAFF"] as const) {
          const response = await request(
            "/services",
            actors.get(role)!.token,
            "POST",
            payload,
          )
          assert.equal(response.status, 403, role)
        }
        assert.equal(uploadSequence, 0)
        assert.equal(await prisma.service.count(), 0)
      },
    )

    await t.test(
      "rejects negative, spoofed, animated, and conflicting image inputs with 400 and zero storage writes",
      async () => {
        const adminToken = actors.get("ADMIN")!.token
        const pngBuffer = await sharp({
          create: { width: 8, height: 8, channels: 3, background: "blue" },
        })
          .png()
          .toBuffer()
        const secondFrame = await sharp({
          create: { width: 4, height: 4, channels: 4, background: "white" },
        })
          .png()
          .toBuffer()
        const animatedGif = await sharp({
          create: {
            width: 4,
            height: 8,
            pageHeight: 4,
            channels: 4,
            background: "blue",
          },
        })
          .composite([{ input: secondFrame, top: 4, left: 0 }])
          .gif({ delay: [100, 100] })
          .toBuffer()
        const animatedWebp = await sharp(animatedGif, { animated: true })
          .webp()
          .toBuffer()

        const invalidPayloads: Record<string, unknown>[] = [
          {
            ...baseService,
            name: "Upload And Remove Conflict",
            imageDataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
            imageAltText: "Valid alt text",
            removeImage: true,
          },
          {
            ...baseService,
            name: "Missing Alt Text",
            imageDataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
            imageAltText: "   ",
          },
          {
            ...baseService,
            name: "Too Long Alt Text",
            imageDataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
            imageAltText: "A".repeat(161),
          },
          {
            ...baseService,
            name: "Spoofed JPEG Header",
            imageDataUrl: `data:image/jpeg;base64,${pngBuffer.toString("base64")}`,
            imageAltText: "Spoofed MIME type",
          },
          {
            ...baseService,
            name: "Animated WebP Service",
            imageDataUrl: `data:image/webp;base64,${animatedWebp.toString("base64")}`,
            imageAltText: "Animated service image",
          },
          {
            ...baseService,
            name: "Corrupt Bytes Service",
            imageDataUrl: `data:image/webp;base64,${Buffer.from("not-valid-webp-bytes").toString("base64")}`,
            imageAltText: "Corrupt service image",
          },
          {
            ...baseService,
            name: "SVG Rejected Service",
            imageDataUrl: `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
            imageAltText: "SVG vector payload",
          },
          {
            ...baseService,
            name: "Invalid RemoveImage Flag",
            removeImage: "true",
          },
        ]

        for (const payload of invalidPayloads) {
          const response = await request(
            "/services",
            adminToken,
            "POST",
            payload,
          )
          assert.equal(
            response.status,
            400,
            `${String(payload.name)}: ${await response.text()}`,
          )
        }
        assert.equal(uploadSequence, 0)
        assert.equal(storedObjects.size, 0)
        assert.equal(await prisma.service.count(), 0)
      },
    )

    await t.test(
      "normalizes oversized PNG, replaces with JPEG, removes on request, and cleans up on 503/409/DELETE",
      async () => {
        const adminToken = actors.get("ADMIN")!.token
        const superadminToken = actors.get("SUPERADMIN")!.token
        const oversizedPngUrl = await makeDataUrl("png", 3000, 1500)

        failNextUpload = true
        const storageDown = await request("/services", adminToken, "POST", {
          ...baseService,
          name: "Transient Storage Failure",
          imageDataUrl: oversizedPngUrl,
          imageAltText: "Hero banner",
        })
        assert.equal(storageDown.status, 503)
        assert.equal(await prisma.service.count(), 0)

        const created = await request("/services", adminToken, "POST", {
          ...baseService,
          name: "Brand Identity Design",
          imageDataUrl: oversizedPngUrl,
          imageAltText: "Brand identity showcase",
        })
        assert.equal(created.status, 201, await created.clone().text())
        const { service } = (await created.json()) as {
          service: {
            id: string
            imageUrl: string | null
            imageAltText: string | null
            imagePath?: unknown
          }
        }
        assert.equal("imagePath" in service, false)
        assert.equal(
          service.imageUrl,
          "https://images.example.com/services/svc-img-1.webp",
        )
        const storedFirst = storedObjects.get("services/svc-img-1.webp")
        assert.ok(storedFirst)
        const firstMeta = await sharp(storedFirst).metadata()
        assert.equal(firstMeta.format, "webp")
        assert.equal(firstMeta.width, 2560)
        assert.equal(firstMeta.height, 1280)

        // Duplicate name rolls back the newly uploaded WebP object.
        const duplicate = await request("/services", superadminToken, "POST", {
          ...baseService,
          name: "Brand Identity Design",
          imageDataUrl: await makeDataUrl("jpeg"),
          imageAltText: "Duplicate service image",
        })
        assert.equal(duplicate.status, 409)
        assert.equal(storedObjects.has("services/svc-img-2.webp"), false)
        assert.equal(removedPaths.at(-1), "services/svc-img-2.webp")

        // Retaining an existing image while blanking alt text is rejected.
        const missingAltOnKeep = await request(
          `/services/${service.id}`,
          adminToken,
          "PUT",
          {
            ...baseService,
            name: "Brand Identity Design",
            imageAltText: "   ",
          },
        )
        assert.equal(missingAltOnKeep.status, 400)

        // Replacing with JPEG writes a new WebP and removes the previous WebP.
        const replaced = await request(
          `/services/${service.id}`,
          superadminToken,
          "PUT",
          {
            ...baseService,
            name: "Brand Identity Design",
            imageDataUrl: await makeDataUrl("jpeg", 20, 10),
            imageAltText: "Updated brand showcase",
          },
        )
        assert.equal(replaced.status, 200, await replaced.clone().text())
        assert.equal(storedObjects.has("services/svc-img-1.webp"), false)
        assert.equal(storedObjects.has("services/svc-img-3.webp"), true)

        // Explicit removeImage clears DB fields and deletes stored WebP.
        const cleared = await request(
          `/services/${service.id}`,
          adminToken,
          "PUT",
          {
            ...baseService,
            name: "Brand Identity Design",
            removeImage: true,
          },
        )
        assert.equal(cleared.status, 200, await cleared.clone().text())
        const clearedBody = (await cleared.json()) as {
          service: { imageUrl: string | null; imageAltText: string | null }
        }
        assert.equal(clearedBody.service.imageUrl, null)
        assert.equal(clearedBody.service.imageAltText, null)
        assert.equal(storedObjects.has("services/svc-img-3.webp"), false)

        // Re-add an image, deactivate, and delete — storage object is cleaned up.
        const readded = await request(
          `/services/${service.id}`,
          adminToken,
          "PUT",
          {
            ...baseService,
            name: "Brand Identity Design",
            imageDataUrl: await makeDataUrl("webp", 12, 12),
            imageAltText: "Final service artwork",
          },
        )
        assert.equal(readded.status, 200)
        assert.equal(storedObjects.has("services/svc-img-4.webp"), true)

        await request(`/services/${service.id}/status`, adminToken, "PATCH", {
          isActive: false,
        })
        const deleted = await request(
          `/services/${service.id}`,
          adminToken,
          "DELETE",
        )
        assert.equal(deleted.status, 200)
        assert.equal(storedObjects.size, 0)
        assert.equal(legacyUploadCalls, 0)
      },
    )
  },
)
