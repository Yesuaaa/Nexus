import type { InquiryInput, ServiceListing } from "../model/types"

export class PublicServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/public" + path, {
    ...options,
    cache: "no-store",
    credentials: "omit",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(25_000)])
      : AbortSignal.timeout(25_000),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : response.status >= 500
          ? "Services are temporarily unavailable. Please try again shortly."
          : "We couldn't complete the request. Please try again."
    throw new PublicServiceError(message, response.status)
  }
  return body as T
}

export function listPublicServices(
  query: string,
  page: number,
  signal?: AbortSignal,
  category?: string,
) {
  const params = new URLSearchParams({ q: query, page: String(page) })
  if (category) params.set("category", category)
  return publicRequest<ServiceListing>("/services?" + params.toString(), {
    signal,
  })
}
export function sendPublicInquiry(id: string, input: InquiryInput) {
  return publicRequest<{
    inquiry: { id: string; status: string; createdAt: string }
    message: string
    replayed: boolean
  }>("/services/" + encodeURIComponent(id) + "/inquiries", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
