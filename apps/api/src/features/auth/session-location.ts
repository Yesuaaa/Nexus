import { isIP } from "node:net"

export function publicSessionIp(value: string | undefined): string | null {
  if (!value) return null
  const ip =
    value.toLowerCase().startsWith("::ffff:") && value.includes(".")
      ? value.slice(7)
      : value
  const version = isIP(ip)
  if (version === 4) {
    const [a, b, c] = ip.split(".").map(Number)
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a! >= 224 ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    )
      return null
    return ip
  }
  if (version === 6) {
    const [first, second = "0"] = ip.toLowerCase().split(":")
    const prefix = parseInt(first!, 16)
    if (
      !Number.isFinite(prefix) ||
      prefix < 0x2000 ||
      prefix >= 0x3ffe ||
      prefix === 0x2002 ||
      (prefix === 0x2001 &&
        (parseInt(second, 16) < 0x200 || parseInt(second, 16) === 0xdb8))
    )
      return null
    return ip
  }
  return null
}

export function trustedProxyAddresses(
  value: string | undefined,
): string[] | false {
  if (!value?.trim()) return false
  const addresses = value.split(",").map((part) => part.trim())
  for (const address of addresses) {
    const [ip, prefix, extra] = address.split("/")
    const version = isIP(ip!)
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)))
    )
      throw new Error(
        "TRUST_PROXY must contain trusted proxy IP addresses or CIDRs",
      )
  }
  return addresses
}

export async function approximateSessionLocation(
  ip: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const publicIp = publicSessionIp(ip)
  if (!publicIp || process.env.SESSION_GEOLOCATION !== "ipapi") return null
  try {
    const response = await fetcher(
      "https://ipapi.co/" + encodeURIComponent(publicIp) + "/json/",
      {
        signal: AbortSignal.timeout(1200),
        redirect: "error",
        headers: {
          accept: "application/json",
          "user-agent": "Nexus-session-location",
        },
      },
    )
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (!data || typeof data !== "object" || Array.isArray(data)) return null
    const record = data as Record<string, unknown>
    if (record.error || typeof record.country_name !== "string") return null
    const clean = (value: unknown) =>
      typeof value === "string" && value.length <= 100
        ? Array.from(value)
            .filter(
              (char) =>
                char.codePointAt(0)! >= 32 && char.codePointAt(0) !== 127,
            )
            .join("")
            .trim()
        : ""
    const country = clean(record.country_name)
    return country
      ? [clean(record.city), country].filter(Boolean).join(", ")
      : null
  } catch {
    return null
  }
}
