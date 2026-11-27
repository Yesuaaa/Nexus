import { getPrisma } from "../../lib/db.js"
import { activeAccount } from "../../shared/query/accounts.js"
import {
  ImageNormalizationError,
  normalizeImageDataUrlToWebp,
} from "../../shared/image-normalization.js"
import { AuthError } from "./auth.service.js"
import { getProfile } from "./profile.service.js"
import {
  getServiceImageStorage,
  ServiceImageStorageError,
} from "../services/service-image-storage.js"

function validateLegacyImage(dataUrl: string) {
  const match = dataUrl.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
  )
  if (!match)
    throw new AuthError(400, "Choose a JPEG, PNG, or WebP image up to 2 MB")
  const data = Buffer.from(match[2]!, "base64")
  if (
    !data.length ||
    data.length > 2 * 1024 * 1024 ||
    data.toString("base64").replace(/=+$/, "") !== match[2]!.replace(/=+$/, "")
  )
    throw new AuthError(400, "Choose an image up to 2 MB")
  const valid =
    match[1] === "png"
      ? data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "jpeg"
        ? data[0] === 255 && data[1] === 216 && data[2] === 255
        : data.subarray(0, 4).toString() === "RIFF" &&
          data.subarray(8, 12).toString() === "WEBP"
  if (!valid)
    throw new AuthError(400, "The image content does not match its file type")
}

export async function uploadProfileImage(userId: string, input: unknown) {
  const body =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { kind?: unknown; dataUrl?: unknown })
      : null
  if (
    !body ||
    typeof body.kind !== "string" ||
    !["avatar", "banner", "project"].includes(body.kind)
  )
    throw new AuthError(400, "Choose a profile photo, banner, or project image")
  const kind = body.kind as "avatar" | "banner" | "project"
  const prisma = getPrisma()
  if (!prisma) throw new AuthError(503, "Database unavailable")
  const user = await prisma.user.findFirst({
    where: { id: userId, ...activeAccount },
    select: {
      role: true,
      profileImagePath: true,
      employee: { select: { id: true } },
    },
  })
  if (!user) throw new AuthError(404, "Account unavailable")
  if (kind === "project" && (user.role !== "STAFF" || !user.employee))
    throw new AuthError(
      403,
      "Only staff with a linked employee record can upload project images",
    )
  if (
    typeof body.dataUrl !== "string" ||
    body.dataUrl.length > 2.8 * 1024 * 1024
  )
    throw new AuthError(400, "Choose a JPEG, PNG, or WebP image up to 2 MB")
  const directory = `profiles/${userId}/${kind}`
  let storage: ReturnType<typeof getServiceImageStorage>
  let path: string
  try {
    if (kind === "avatar") {
      const image = await normalizeImageDataUrlToWebp(body.dataUrl, {
        maxInputBytes: 2 * 1024 * 1024,
        maxOutputBytes: 2 * 1024 * 1024,
        maxInputPixels: 25_000_000,
        maxWidth: 1024,
        maxHeight: 1024,
      })
      storage = getServiceImageStorage()
      path = await storage.uploadWebp(image.data, directory)
    } else {
      validateLegacyImage(body.dataUrl)
      storage = getServiceImageStorage()
      path = await storage.upload(body.dataUrl, directory)
    }
  } catch (error) {
    if (error instanceof ImageNormalizationError)
      throw new AuthError(400, error.message)
    if (error instanceof ServiceImageStorageError)
      throw new AuthError(
        503,
        "Image storage is unavailable. Please try again or contact an administrator.",
      )
    throw error
  }
  const url = storage.publicUrl(path)
  if (kind === "project") return { url, profile: null }
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          ...activeAccount,
          ...(kind === "avatar" && { profileImagePath: user.profileImagePath }),
        },
        data:
          kind === "avatar"
            ? { profileImagePath: path }
            : { profileBannerPath: path },
      })
      if (!changed.count) {
        if (
          kind === "avatar" &&
          (await tx.user.count({ where: { id: userId, ...activeAccount } }))
        )
          throw new AuthError(409, "Your profile picture changed. Try again.")
        throw new AuthError(404, "Account unavailable")
      }
      if (user.role === "STAFF")
        await tx.employee.updateMany({
          where: { userId },
          data:
            kind === "avatar"
              ? { profileImageUrl: url }
              : { profileBannerUrl: url },
        })
    })
  } catch (error) {
    try {
      await storage.remove(path)
    } catch {
      console.error("Unable to remove an uncommitted profile image")
    }
    throw error
  }
  if (
    kind === "avatar" &&
    user.profileImagePath?.startsWith(directory + "/") &&
    user.profileImagePath !== path
  ) {
    try {
      await storage.remove(user.profileImagePath)
    } catch {
      console.error("Unable to remove replaced avatar", user.profileImagePath)
    }
  }
  return { url, profile: await getProfile(userId) }
}
