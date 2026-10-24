import { apiUrl } from "../../lib/api-url.ts"

export type StatusEndpoint = "/api/health" | "/api/db-check"

export async function checkEndpoint(path: StatusEndpoint): Promise<boolean> {
  try {
    const response = await fetch(apiUrl(path))
    return response.ok
  } catch {
    return false
  }
}
