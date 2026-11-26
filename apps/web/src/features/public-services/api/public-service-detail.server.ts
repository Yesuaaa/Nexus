import type { PublicService } from "../model/types"

export async function readPublicService(
  id: string,
): Promise<
  | { status: "available"; service: PublicService }
  | { status: "missing" }
  | { status: "unavailable" }
> {
  const apiOrigin = (
    process.env.API_PROXY_TARGET || "http://localhost:3001"
  ).replace(/\/$/, "")
  try {
    const response = await fetch(
      `${apiOrigin}/api/public/services/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8_000) },
    )
    if (response.status === 404) return { status: "missing" }
    if (!response.ok) return { status: "unavailable" }
    const { service } = (await response.json()) as { service: PublicService }
    return { status: "available", service }
  } catch {
    return { status: "unavailable" }
  }
}
