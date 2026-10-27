import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { buildContentSecurityPolicy } from "@/lib/content-security-policy"

function getApiOrigin() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return ""

  try {
    const origin = new URL(apiUrl)
    if (
      (origin.protocol !== "http:" && origin.protocol !== "https:") ||
      origin.hostname.includes("*")
    ) {
      return ""
    }
    return origin.origin
  } catch {
    return ""
  }
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64")
  const apiOrigin = getApiOrigin()
  const csp = buildContentSecurityPolicy(nonce, apiOrigin)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
