import { createHash } from "node:crypto"
import { isStrongPassword } from "../../src/shared/password-policy.js"

export const SHOWCASE_PREFIX = "showcase-2026-"
export const showcaseId = (kind: string, index: number) =>
  `${SHOWCASE_PREFIX}${kind}-${String(index).padStart(3, "0")}`
export function showcaseUuid(kind: string, index: number): string {
  const bytes = createHash("sha256")
    .update(showcaseId(kind, index))
    .digest("hex")
  return `${bytes.slice(0, 8)}-${bytes.slice(8, 12)}-4${bytes.slice(13, 16)}-a${bytes.slice(17, 20)}-${bytes.slice(20, 32)}`
}
export function assertShowcaseTarget(env: NodeJS.ProcessEnv) {
  const raw = env.DATABASE_URL || env.DIRECT_URL || ""
  const url = URL.parse(raw)
  if (
    env.NODE_ENV !== "development" ||
    !url ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["/nexus_dev", "/nexus_showcase"].includes(url.pathname) ||
    !["", "?sslmode=disable"].includes(url.search)
  )
    throw new Error(
      "Showcase seed only supports a local nexus_dev or nexus_showcase database with NODE_ENV=development",
    )
  const direct = env.DIRECT_URL ? URL.parse(env.DIRECT_URL) : url
  if (
    !direct ||
    direct.hostname !== url.hostname ||
    direct.port !== url.port ||
    direct.pathname !== url.pathname ||
    direct.protocol !== url.protocol
  )
    throw new Error(
      "DATABASE_URL and DIRECT_URL must identify the same local database",
    )
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.slice(1),
  }
}
export function assertShowcasePassword(
  password: string | undefined,
): asserts password is string {
  if (!password || !isStrongPassword(password))
    throw new Error(
      "Set SHOWCASE_PASSWORD to a strong development-only password",
    )
}
export const organizations = [
  "Avelora Retail",
  "Northline Hospitality",
  "Meridian Creative",
  "Verde Living",
  "Atlas Commerce",
  "Solstice Events",
  "Harbor & Co.",
  "Forma Studio",
  "Kestrel Foods",
  "Luna Wellness",
  "Cedar Home",
  "Marina Travel",
] as const
export const plannedCounts = {
  accounts: 34,
  clients: 12,
  employees: 20,
  requests: 36,
  projects: 12,
  invoices: 36,
  payments: 24,
  expenses: 18,
  inquiries: 9,
  packages: 18,
  conversations: 12,
  requestMessages: 24,
  internalConversations: 4,
  internalMessages: 8,
} as const
