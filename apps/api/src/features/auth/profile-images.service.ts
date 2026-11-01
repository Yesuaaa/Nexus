import { getPrisma } from "../../lib/db.js"
import { AuthError } from "./auth.service.js"
import { getProfile } from "./profile.service.js"
import { getServiceImageStorage, ServiceImageStorageError } from "../services/service-image-storage.js"

export async function uploadProfileImage(userId: string, input: unknown) {
  const body = input as { kind?: unknown; dataUrl?: unknown } | null
  if (!body || !["avatar", "banner", "project"].includes(String(body.kind))) throw new AuthError(400, "Choose a profile photo, banner, or project image")
  const kind = body.kind as "avatar" | "banner" | "project"
  const prisma = getPrisma()
  if (!prisma) throw new AuthError(503, "Database unavailable")
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true, accountDeletedAt: null }, select: { role: true, employee: { select: { id: true } } } })
  if (!user) throw new AuthError(404, "Account unavailable")
  if (kind === "project" && (user.role !== "STAFF" || !user.employee)) throw new AuthError(403, "Only staff with a linked employee record can upload project images")
  const match = typeof body.dataUrl === "string" && body.dataUrl.length <= 2.8 * 1024 * 1024 ? body.dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/) : null
  if (!match) throw new AuthError(400, "Choose a JPEG, PNG, or WebP image up to 2 MB")
  const data = Buffer.from(match[2]!, "base64")
  if (!data.length || data.length > 2 * 1024 * 1024 || data.toString("base64").replace(/=+$/, "") !== match[2]!.replace(/=+$/, "")) throw new AuthError(400, "Choose an image up to 2 MB")
  const valid = match[1] === "png" ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === "jpeg" ? data[0] === 255 && data[1] === 216 && data[2] === 255 : data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP"
  if (!valid) throw new AuthError(400, "The image content does not match its file type")
  let storage: ReturnType<typeof getServiceImageStorage>
  let path: string
  try { storage = getServiceImageStorage(); path = await storage.upload(body!.dataUrl as string, `profiles/${userId}/${kind}`) } catch (error) { if (error instanceof ServiceImageStorageError) throw new AuthError(503, "Image storage is unavailable. Please try again or contact an administrator."); throw error }
  const url = storage.publicUrl(path)
  if (kind === "project") return { url, profile: null }
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({ where: { id: userId, isActive: true, accountDeletedAt: null }, data: kind === "avatar" ? { profileImagePath: path } : { profileBannerPath: path } })
      if (!changed.count) throw new AuthError(404, "Account unavailable")
      if (user.role === "STAFF") await tx.employee.updateMany({ where: { userId }, data: kind === "avatar" ? { profileImageUrl: url } : { profileBannerUrl: url } })
    })
  } catch (error) { try { await storage.remove(path) } catch { console.error("Unable to remove an uncommitted profile image") }; throw error }
  return { url, profile: await getProfile(userId) }
}
