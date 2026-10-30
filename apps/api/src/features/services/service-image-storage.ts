import { randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const defaultBucket = "service-images"
const maxImageBytes = 2 * 1024 * 1024
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"]
const imagePattern =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
const extensions = { jpeg: "jpg", png: "png", webp: "webp" } as const

export type ServiceImageStorage = {
  upload(dataUrl: string): Promise<string>
  remove(path: string): Promise<void>
  publicUrl(path: string): string
}

export class ServiceImageStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ServiceImageStorageError"
  }
}

let storageOverride: ServiceImageStorage | undefined
let cachedStorage:
  { signature: string; storage: ServiceImageStorage } | undefined

export function setServiceImageStorageForTests(
  storage: ServiceImageStorage | undefined,
) {
  storageOverride = storage
}

function storageConfiguration() {
  const url = process.env.SUPABASE_URL?.trim()
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket =
    process.env.SUPABASE_SERVICE_IMAGES_BUCKET?.trim() || defaultBucket
  if (!url || !secretKey) {
    throw new ServiceImageStorageError(
      "Service image storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.",
    )
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket)) {
    throw new ServiceImageStorageError("Service image bucket name is invalid")
  }
  return { url, secretKey, bucket }
}

function supabaseStorage({
  url,
  secretKey,
  bucket,
}: ReturnType<typeof storageConfiguration>): ServiceImageStorage {
  const client: SupabaseClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
  let bucketReady: Promise<void> | undefined

  async function ensureBucket() {
    if (bucketReady) return bucketReady
    bucketReady = (async () => {
      const options = {
        public: true,
        allowedMimeTypes,
        fileSizeLimit: maxImageBytes,
      }
      const { data, error } = await client.storage.getBucket(bucket)
      const result =
        !error && data
          ? await client.storage.updateBucket(bucket, options)
          : await client.storage.createBucket(bucket, options)
      if (result.error) {
        console.error(
          "Supabase service image bucket setup failed",
          result.error,
        )
        throw new ServiceImageStorageError(
          "Service image storage could not be prepared. Check the Supabase Storage configuration.",
        )
      }
    })()
    try {
      await bucketReady
    } catch (error) {
      bucketReady = undefined
      throw error
    }
  }

  return {
    async upload(dataUrl) {
      const match = dataUrl.match(imagePattern)
      if (!match) {
        throw new ServiceImageStorageError("Service image data is invalid")
      }
      const subtype = match[1] as keyof typeof extensions
      const path = `services/${randomUUID()}.${extensions[subtype]}`
      await ensureBucket()
      const { error } = await client.storage
        .from(bucket)
        .upload(path, Buffer.from(match[2]!, "base64"), {
          cacheControl: "31536000",
          contentType: `image/${subtype}`,
          upsert: false,
        })
      if (error) {
        console.error("Supabase service image upload failed", error)
        throw new ServiceImageStorageError(
          "The service image could not be uploaded. Please try again.",
        )
      }
      return path
    },

    async remove(path) {
      const { error } = await client.storage.from(bucket).remove([path])
      if (error) {
        console.error("Supabase service image removal failed", error)
        throw new ServiceImageStorageError(
          "The previous service image could not be removed",
        )
      }
    },

    publicUrl(path) {
      return client.storage.from(bucket).getPublicUrl(path).data.publicUrl
    },
  }
}

export function getServiceImageStorage() {
  if (storageOverride) return storageOverride
  const configuration = storageConfiguration()
  const signature = `${configuration.url}\0${configuration.secretKey}\0${configuration.bucket}`
  if (cachedStorage?.signature === signature) return cachedStorage.storage
  const storage = supabaseStorage(configuration)
  cachedStorage = { signature, storage }
  return storage
}

export function serviceImagePublicUrl(path: string | null) {
  if (!path) return null
  try {
    return getServiceImageStorage().publicUrl(path)
  } catch (error) {
    if (error instanceof ServiceImageStorageError) return null
    throw error
  }
}
