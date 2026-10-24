import "dotenv/config"
import { Role } from "./generated/prisma/client.js"
import { getPrisma } from "./db.js"
import { hashPassword, validPassword } from "./password.js"

async function main() {
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")

  try {
    const existingSuperadmin = await prisma.user.findFirst({
      where: { role: Role.SUPERADMIN },
      select: { id: true },
    })
    if (existingSuperadmin) {
      console.log("A Superadmin already exists; seed skipped")
      return
    }

    const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase()
    const password = process.env.BOOTSTRAP_PASSWORD
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !validPassword(password)
    ) {
      throw new Error(
        "Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD (at least 12 characters) to seed the first Superadmin",
      )
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new Error(
        "The bootstrap email already belongs to an account; use a new email",
      )
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: Role.SUPERADMIN,
      },
    })
    console.log(`Created Superadmin: ${email}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  if (
    error instanceof Error &&
    /self-signed certificate in certificate chain|unable to get local issuer certificate/i.test(
      error.message,
    )
  ) {
    console.error(
      "Database TLS certificate is not trusted. Download the database CA certificate from Supabase Database Settings > SSL Configuration, then set sslmode=verify-full and sslrootcert in DATABASE_URL. See README.md.",
    )
  } else {
    console.error(error)
  }
  process.exitCode = 1
})
