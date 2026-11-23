import { Role, type PrismaClient } from "../../src/generated/prisma/client.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"

const accounts = [
  {
    role: Role.SUPERADMIN,
    email: "superadmin@nexus.test",
    fullName: "Local Superadmin",
  },
  { role: Role.ADMIN, email: "admin@nexus.test", fullName: "Local Admin" },
  { role: Role.STAFF, email: "staff@nexus.test", fullName: "Local Staff" },
  { role: Role.USER, email: "client@nexus.test", fullName: "Local Client" },
]

export function assertDevSeedTarget(env: NodeJS.ProcessEnv) {
  const url = URL.parse(env.DATABASE_URL || env.DIRECT_URL || "")
  if (
    env.NODE_ENV !== "development" ||
    !url ||
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]", "db"].includes(url.hostname) ||
    url.pathname !== "/nexus_dev" ||
    !["", "?sslmode=disable"].includes(url.search)
  ) {
    throw new Error(
      "The development seed requires the local nexus_dev PostgreSQL database and NODE_ENV=development",
    )
  }
}

export async function seedDevAccounts(prisma: PrismaClient, password: string) {
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.user.findMany({
        select: {
          email: true,
          role: true,
          isActive: true,
          accountDeletedAt: true,
        },
      })
      const hasOtherAccounts = existing.some(
        (user) =>
          !user.isActive ||
          user.accountDeletedAt !== null ||
          !accounts.some(
            ({ email, role }) => email === user.email && role === user.role,
          ),
      )
      if (hasOtherAccounts) {
        throw new Error(
          "Use a fresh development database or one with only the expected active development accounts",
        )
      }

      for (const account of accounts) {
        if (existing.some(({ email }) => email === account.email)) continue

        await tx.user.create({
          data: {
            ...account,
            passwordHash: await hashPassword(password),
            ...(account.role === Role.STAFF && {
              employee: {
                create: {
                  employeeId: "EXP-DEV-STAFF",
                  fullName: account.fullName,
                  email: account.email,
                },
              },
            }),
          },
        })
      }
    },
    { isolationLevel: "Serializable" },
  )
}
