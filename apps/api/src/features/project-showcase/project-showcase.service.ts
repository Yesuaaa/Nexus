import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { isPlainObject } from "../../shared/validation.js"
import {
  getServiceImageStorage,
  removeLocalServiceImage,
  serviceImagePublicUrl,
  uploadLocalServiceImage,
} from "../services/service-image-storage.js"
import {
  isShowcaseImage,
  showcaseImageLayouts,
} from "./project-showcase-images.js"

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const cardSelect = {
  slug: true,
  name: true,
  client: true,
  type: true,
  image: true,
  fictional: true,
} satisfies Prisma.ProjectShowcaseEntrySelect
const detailSelect = {
  ...cardSelect,
  year: true,
  description: true,
  galleryLayout: true,
  additionalImages: true,
} satisfies Prisma.ProjectShowcaseEntrySelect
const managementSelect = {
  ...detailSelect,
  id: true,
  position: true,
  published: true,
  featured: true,
  version: true,
  archivedAt: true,
} satisfies Prisma.ProjectShowcaseEntrySelect
const orderBy = [
  { position: "asc" },
  { slug: "asc" },
] satisfies Prisma.ProjectShowcaseEntryOrderByWithRelationInput[]

function entries() {
  const prisma = getPrisma()
  if (!prisma) fail(503, "Project Showcase is temporarily unavailable.")
  return prisma.projectShowcaseEntry
}

function requiredText(value: unknown, label: string, max: number) {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized || normalized.length > max || normalized.includes("\u0000")) {
    fail(400, `${label} must contain between 1 and ${max} characters.`)
  }
  return normalized
}

function integer(value: unknown, label: string, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    fail(400, `${label} must be a whole number between ${min} and ${max}.`)
  }
  return value
}

function imageSource(value: unknown, label: string) {
  const image = requiredText(value, label, 1000)
  if (!isShowcaseImage(image))
    fail(
      400,
      `${label} must use a built-in landing image or a public Supabase JPEG, PNG, or WebP URL.`,
    )
  return image
}

function parseGallery(input: Record<string, unknown>) {
  if (input.galleryLayout === undefined && input.additionalImages === undefined)
    return {}

  const layout = showcaseImageLayouts.find(
    ({ id }) => id === input.galleryLayout,
  )
  if (!layout) fail(400, "Choose a supported image layout.")
  if (
    !Array.isArray(input.additionalImages) ||
    input.additionalImages.length !== layout.count - 1
  ) {
    fail(
      400,
      `The selected layout requires ${layout.count} total images, including the cover.`,
    )
  }
  return {
    galleryLayout: layout.id,
    additionalImages: input.additionalImages.map((image: unknown, index) =>
      imageSource(image, `Image ${index + 2}`),
    ),
  }
}

function parseEntry(input: unknown) {
  if (!isPlainObject(input)) fail(400, "Invalid project details.")
  const { published, featured, fictional } = input
  if (
    typeof published !== "boolean" ||
    typeof featured !== "boolean" ||
    typeof fictional !== "boolean"
  ) {
    fail(400, "Invalid publication settings.")
  }
  const slug = requiredText(input.slug, "Page address", 100)
  if (!slugPattern.test(slug))
    fail(
      400,
      "Use lowercase letters, numbers, and hyphens for the page address.",
    )
  return {
    slug,
    name: requiredText(input.name, "Project title", 120),
    client: requiredText(input.client, "Client", 120),
    type: requiredText(input.type, "Service", 100),
    year: input.year === null ? null : integer(input.year, "Year", 1900, 9999),
    description: requiredText(input.description, "Description", 4000),
    image: imageSource(input.image, "Cover image"),
    ...parseGallery(input),
    position: integer(input.position, "Display order", 0, 99999),
    published,
    featured,
    fictional,
  }
}

export function listPublicShowcase(homepage: boolean) {
  return entries().findMany({
    where: {
      published: true,
      archivedAt: null,
      ...(homepage ? { featured: true } : {}),
    },
    orderBy,
    select: cardSelect,
    ...(homepage ? { take: 3 } : {}),
  })
}

export async function readPublicShowcase(slug: unknown) {
  if (typeof slug !== "string" || slug.length > 100 || !slugPattern.test(slug))
    fail(404, "Project not found.")
  const project = await entries().findUnique({
    where: { slug, published: true, archivedAt: null },
    select: detailSelect,
  })
  if (!project) fail(404, "Project not found.")
  return project
}

export function listShowcaseEntries(archived: boolean) {
  return entries().findMany({
    where: { archivedAt: archived ? { not: null } : null },
    orderBy,
    select: managementSelect,
  })
}

export async function reorderShowcaseEntries(input: unknown) {
  if (
    !isPlainObject(input) ||
    !Array.isArray(input.projects) ||
    input.projects.length > 100000
  )
    fail(400, "Invalid project order.")
  const requested = input.projects.map((item: unknown) => {
    if (!isPlainObject(item) || typeof item.id !== "string" || !item.id)
      fail(400, "Invalid project order.")
    return {
      id: item.id,
      version: integer(item.version, "Version", 0, 2147483646),
    }
  })
  if (new Set(requested.map(({ id }) => id)).size !== requested.length)
    fail(400, "Invalid project order.")
  const prisma = getPrisma()
  if (!prisma) fail(503, "Project Showcase is temporarily unavailable.")
  return prisma.$transaction(async (tx) => {
    const current = await tx.projectShowcaseEntry.findMany({
      where: { archivedAt: null },
      select: { id: true, version: true },
    })
    const versions = new Map(current.map(({ id, version }) => [id, version]))
    if (
      current.length !== requested.length ||
      requested.some(({ id, version }) => versions.get(id) !== version)
    )
      fail(409, "Projects changed. Refresh and try again.")
    for (const [position, { id, version }] of requested.entries()) {
      const result = await tx.projectShowcaseEntry.updateMany({
        where: { id, version, archivedAt: null },
        data: { position, version: { increment: 1 } },
      })
      if (result.count !== 1)
        fail(409, "Projects changed. Refresh and try again.")
    }
    return tx.projectShowcaseEntry.findMany({
      where: { archivedAt: null },
      orderBy,
      select: managementSelect,
    })
  })
}

export function changeShowcaseArchive(
  id: string,
  input: unknown,
  archive: boolean,
) {
  if (!isPlainObject(input)) fail(400, "Invalid project details.")
  const version = integer(input.version, "Version", 0, 2147483646)
  return entries().update({
    where: { id, version, archivedAt: archive ? null : { not: null } },
    data: {
      archivedAt: archive ? new Date() : null,
      published: false,
      version: { increment: 1 },
    },
    select: managementSelect,
  })
}

export function deleteArchivedShowcase(id: string, input: unknown) {
  if (!isPlainObject(input)) fail(400, "Invalid project details.")
  const version = integer(input.version, "Version", 0, 2147483646)
  return entries().delete({
    where: { id, version, archivedAt: { not: null } },
    select: { id: true },
  })
}

async function saveWithImages(input: unknown, id?: string) {
  if (!isPlainObject(input)) fail(400, "Invalid project details.")
  const uploaded: string[] = []
  async function resolveImage(value: unknown): Promise<unknown> {
    if (typeof value !== "string" || !value.startsWith("data:")) return value
    const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
    if (!match || Buffer.byteLength(match[1]!, "base64") > 2 * 1024 * 1024)
      fail(400, "Choose a WebP image up to 2 MB.")
    const bytes = Buffer.from(match[1]!, "base64")
    if (
      bytes.length < 12 ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WEBP"
    )
      fail(400, "The selected WebP image is invalid.")
    const path =
      process.env.SERVICE_IMAGE_STORAGE === "local"
        ? await uploadLocalServiceImage(value)
        : await getServiceImageStorage().upload(value, "project-showcase")
    uploaded.push(path)
    const url = serviceImagePublicUrl(path)
    if (!url) fail(503, "Image storage is unavailable.")
    return url
  }
  try {
    const serviceName = requiredText(input.type, "Service", 100)
    const prisma = getPrisma()
    if (!prisma) fail(503, "Project Showcase is temporarily unavailable.")
    const service = await prisma.service.findUnique({
      where: { name: serviceName },
      select: { name: true },
    })
    if (!service) {
      const existing = id
        ? await entries().findUnique({ where: { id }, select: { type: true } })
        : null
      if (existing?.type !== serviceName)
        fail(400, "Select an existing service.")
    }
    const image = await resolveImage(input.image)
    let additionalImages: unknown = input.additionalImages
    if (Array.isArray(input.additionalImages)) {
      if (input.additionalImages.length > 4)
        fail(400, "A gallery can contain at most five images.")
      const resolved: unknown[] = []
      for (const value of input.additionalImages)
        resolved.push(await resolveImage(value))
      additionalImages = resolved
    }
    const data = parseEntry({ ...input, image, additionalImages })
    if (!id) return await entries().create({ data, select: managementSelect })
    const version = integer(input.version, "Version", 0, 2147483646)
    return await entries().update({
      where: { id, version, archivedAt: null },
      data: { ...data, version: { increment: 1 } },
      select: managementSelect,
    })
  } catch (error) {
    await Promise.allSettled(
      uploaded.map((path) =>
        path.startsWith("local-services/")
          ? removeLocalServiceImage(path)
          : getServiceImageStorage().remove(path),
      ),
    )
    throw error
  }
}

export function createShowcaseEntry(input: unknown) {
  return saveWithImages(input)
}
export function updateShowcaseEntry(id: string, input: unknown) {
  return saveWithImages(input, id)
}
