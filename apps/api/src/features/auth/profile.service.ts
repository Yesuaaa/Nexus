import { getPrisma } from "../../lib/db.js"
import { publicUser } from "../users/users.dto.js"
import { AuthError } from "./auth.service.js"
import { serviceImagePublicUrl } from "../services/service-image-storage.js"

const employeeInclude = {
  department: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  socialLinks: { orderBy: { displayOrder: "asc" as const } },
  portfolioProjects: { orderBy: { displayOrder: "asc" as const } },
}

export async function getProfile(userId: string) {
  const prisma = getPrisma()
  if (!prisma) throw new AuthError(503, "Database unavailable")
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, accountDeletedAt: null },
    include: { department: true, team: true, headOf: true },
  })
  if (!user) throw new AuthError(404, "Account unavailable")
  const employee =
    user.role !== "USER"
      ? await prisma.employee.findUnique({
          where: { userId },
          include: employeeInclude,
        })
      : null
  return {
    user: publicUser(user),
    imageUrl:
      serviceImagePublicUrl(user.profileImagePath) ||
      (user.role === "STAFF" ? employee?.profileImageUrl : null) ||
      null,
    bannerUrl:
      serviceImagePublicUrl(user.profileBannerPath) ||
      (user.role === "STAFF" ? employee?.profileBannerUrl : null) ||
      null,
    employee: employee
      ? {
          employeeId: employee.employeeId,
          position: employee.position,
          employmentType: employee.employmentType,
          status: employee.status,
          startDate: employee.startDate,
          department: employee.department,
          team: employee.team,
        }
      : null,
    specialist:
      employee && user.role === "STAFF"
        ? {
            bio: employee.profileBio || "",
            imageUrl: employee.profileImageUrl || "",
            specialties: employee.profileSpecialties,
            updatedAt: employee.updatedAt,
            socialLinks: employee.socialLinks.map(({ platform, url }) => ({
              platform,
              url,
            })),
            projects: employee.portfolioProjects.map(
              ({
                title,
                summary,
                contribution,
                thumbnailUrl,
                projectUrl,
                isPublished,
              }) => ({
                title,
                summary,
                contribution: contribution || "",
                thumbnailUrl: thumbnailUrl || "",
                projectUrl: projectUrl || "",
                isPublished,
              }),
            ),
          }
        : null,
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AuthError(400, "Provide valid profile details")
  return value as Record<string, unknown>
}
function text(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 && ![9, 10, 13].includes(code)
    }) ||
    (required && !value.trim())
  )
    throw new AuthError(400, `Provide a valid ${label}`)
  return value.trim()
}
function url(value: unknown, label: string, required = false) {
  const clean = text(value, label, 2048, required)
  if (!clean) return ""
  try {
    const parsed = new URL(clean)
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password)
      return parsed.href
  } catch {
    /* Validation below provides the field-specific error. */
  }
  throw new AuthError(400, `${label} must be an HTTPS URL`)
}
function list(value: unknown, label: string, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit)
    throw new AuthError(400, `Provide at most ${limit} ${label}`)
  return value
}

export async function updateProfile(userId: string, input: unknown) {
  const body = object(input)
  const fullName = text(body.fullName, "full name", 100, true)
  if (fullName.length < 2)
    throw new AuthError(400, "Full name must contain at least two characters")
  const contactNumber = text(body.contactNumber, "contact number", 21)
  if (contactNumber && !/^\+?[0-9][0-9\s-]{6,19}$/.test(contactNumber))
    throw new AuthError(400, "Provide a valid contact number")
  const prisma = getPrisma()
  if (!prisma) throw new AuthError(503, "Database unavailable")
  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: userId, isActive: true, accountDeletedAt: null },
      data: { fullName, contactNumber: contactNumber || null },
    })
    if (!changed.count) throw new AuthError(404, "Account unavailable")
    await tx.employee.updateMany({
      where: { userId },
      data: { fullName, contactNumber: contactNumber || null },
    })
  })
  return getProfile(userId)
}

export async function updateSpecialistProfile(userId: string, input: unknown) {
  const body = object(input)
  const bio = text(body.bio, "bio", 2000)
  const imageUrl = url(body.imageUrl, "Profile image URL")
  const specialties = [
    ...new Set(
      list(body.specialties, "specialties", 20).map((value) =>
        text(value, "specialty", 80, true),
      ),
    ),
  ]
  const links = list(body.socialLinks, "social links", 10).map(
    (value, displayOrder) => {
      const item = object(value)
      return {
        platform: text(item.platform, "platform", 40, true),
        url: url(item.url, "Social link", true),
        displayOrder,
      }
    },
  )
  const projects = list(body.projects, "featured projects", 12).map(
    (value, displayOrder) => {
      const item = object(value)
      if (typeof item.isPublished !== "boolean")
        throw new AuthError(400, "Choose whether the project is published")
      return {
        title: text(item.title, "project title", 160, true),
        summary: text(item.summary, "project summary", 3000, true),
        contribution:
          text(item.contribution, "project contribution", 2000) || null,
        thumbnailUrl: url(item.thumbnailUrl, "Project image URL") || null,
        projectUrl: url(item.projectUrl, "Project URL") || null,
        isPublished: item.isPublished,
        displayOrder,
      }
    },
  )
  const updatedAt = text(body.updatedAt, "profile version", 40, true)
  if (!Number.isFinite(Date.parse(updatedAt)))
    throw new AuthError(400, "Invalid profile version")
  const prisma = getPrisma()
  if (!prisma) throw new AuthError(503, "Database unavailable")
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        role: "STAFF",
        isActive: true,
        accountDeletedAt: null,
      },
      select: { id: true },
    })
    if (!user)
      throw new AuthError(403, "Only staff can edit a specialist profile")
    const employee = await tx.employee.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!employee)
      throw new AuthError(
        409,
        "Ask an administrator to link your employee record before editing your specialist profile",
      )
    const changed = await tx.employee.updateMany({
      where: { id: employee.id, userId, updatedAt: new Date(updatedAt) },
      data: {
        profileBio: bio || null,
        profileImageUrl: imageUrl || null,
        profileSpecialties: specialties,
      },
    })
    if (!changed.count)
      throw new AuthError(
        409,
        "Your profile changed. Reload the page before saving again",
      )
    await tx.specialistSocialLink.deleteMany({
      where: { employeeId: employee.id },
    })
    if (links.length)
      await tx.specialistSocialLink.createMany({
        data: links.map((link) => ({ ...link, employeeId: employee.id })),
      })
    await tx.specialistPortfolioProject.deleteMany({
      where: { employeeId: employee.id },
    })
    if (projects.length)
      await tx.specialistPortfolioProject.createMany({
        data: projects.map((project) => ({
          ...project,
          employeeId: employee.id,
        })),
      })
  })
  return getProfile(userId)
}
