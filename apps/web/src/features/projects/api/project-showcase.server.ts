import type { ShowcaseCard, ShowcaseProject } from "../model/showcase-projects"

async function fetchShowcase<T>(path = ""): Promise<T | "missing" | null> {
  const origin = (
    process.env.API_PROXY_TARGET || "http://localhost:3001"
  ).replace(/\/$/, "")
  try {
    const response = await fetch(`${origin}/api/public/projects${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (response.status === 404) return "missing"
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function listPublicProjects(homepage = false) {
  const body = await fetchShowcase<{ projects: ShowcaseCard[] }>(
    homepage ? "?placement=homepage" : "",
  )
  return body && body !== "missing" ? body.projects : null
}

export async function readPublicProject(slug: string) {
  const body = await fetchShowcase<{ project: ShowcaseProject }>(
    "/" + encodeURIComponent(slug),
  )
  return body && body !== "missing" ? body.project : body
}
