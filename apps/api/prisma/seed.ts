import "dotenv/config"
import { Role } from "../src/generated/prisma/client.js"
import { hashPassword, validPassword } from "../src/features/auth/auth.password.js"
import { normalizedEmail } from "../src/features/auth/auth.schema.js"
import { getPrisma } from "../src/lib/db.js"

async function seedSuperadmin(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
) {
  const existingSuperadmin = await prisma.user.findFirst({
    where: { role: Role.SUPERADMIN },
    select: { id: true },
  })
  if (existingSuperadmin) {
    console.log("A Superadmin already exists; seed skipped")
    return
  }

  const email = normalizedEmail(process.env.BOOTSTRAP_EMAIL)
  const password = process.env.BOOTSTRAP_PASSWORD
  if (!email || !validPassword(password)) {
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
}

async function seedAdmin(prisma: NonNullable<ReturnType<typeof getPrisma>>) {
  const emailValue = process.env.ADMIN_BOOTSTRAP_EMAIL
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD
  if (!emailValue && !password) return

  const email = normalizedEmail(emailValue)
  if (!email || !validPassword(password)) {
    throw new Error(
      "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (at least 12 characters) to seed an Admin",
    )
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  })
  if (existing) {
    if (existing.role !== Role.ADMIN) {
      throw new Error("The Admin bootstrap email belongs to another role")
    }
    console.log(`Admin already exists: ${email}; seed skipped`)
    return
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: Role.ADMIN,
    },
  })
  console.log(`Created Admin: ${email}`)
}

const DEFAULT_DEPARTMENTS = [
  {
    name: "Executive",
    code: "EXEC",
    description: "Executive leadership & strategic management",
  },
  {
    name: "Administration",
    code: "ADMIN",
    description: "Internal operations, facilities, and administration",
  },
  {
    name: "Advertising",
    code: "ADV",
    description: "Paid media, campaigns, and ad operations",
  },
  {
    name: "Marketing",
    code: "MKT",
    description: "Brand strategy, growth, and communications",
  },
  {
    name: "Customer Success",
    code: "CS",
    description: "Client relationship management and client support",
  },
  {
    name: "SEO",
    code: "SEO",
    description: "Search engine optimization and content performance",
  },
  {
    name: "Information Technology",
    code: "IT",
    description: "Technical infrastructure, software, and systems",
  },
]

const DEFAULT_SERVICES = [
  {
    name: "Social Media Management",
    description:
      "Plan, publish, and monitor social media content across client channels.",
    departmentName: "Marketing",
  },
  {
    name: "Paid Ads Management",
    description:
      "Plan, launch, optimize, and report on paid advertising campaigns.",
    departmentName: "Advertising",
  },
  {
    name: "Customer Service",
    description:
      "Handle customer inquiries, support concerns, and service follow-ups.",
    departmentName: "Customer Success",
  },
  {
    name: "Video Management / Marketing",
    description:
      "Plan and manage video content for marketing campaigns and channels.",
    departmentName: "Marketing",
  },
  {
    name: "Website Design & Development",
    description:
      "Design and build responsive websites aligned with client requirements.",
    departmentName: "Information Technology",
  },
  {
    name: "Search Engine Optimization (SEO)",
    description:
      "Improve organic search visibility through technical and content optimization.",
    departmentName: "SEO",
  },
  {
    name: "Email Marketing",
    description:
      "Create, deliver, and measure email campaigns for client audiences.",
    departmentName: "Marketing",
  },
  {
    name: "Graphic Design",
    description:
      "Create campaign graphics, brand assets, and other visual materials.",
    departmentName: "Advertising",
  },
  {
    name: "Ecommerce Management",
    description:
      "Manage online storefront content, promotions, and sales operations.",
    departmentName: "Marketing",
  },
  {
    name: "Community Management",
    description:
      "Engage online communities, moderate conversations, and grow audiences.",
    departmentName: "Marketing",
  },
  {
    name: "Business Development",
    description:
      "Develop partnerships, opportunities, and strategies for business growth.",
    departmentName: "Executive",
  },
  {
    name: "Product Photography",
    description:
      "Produce professional product photographs for campaigns and commerce.",
    departmentName: "Advertising",
  },
  {
    name: "Video Production",
    description: "Produce promotional, corporate, and social video content.",
    departmentName: "Advertising",
  },
  {
    name: "Digital Printing",
    description:
      "Prepare and produce printed marketing and business materials.",
    departmentName: "Advertising",
  },
  {
    name: "Corporate Events Management",
    description:
      "Plan and coordinate corporate events, logistics, and supporting resources.",
    departmentName: "Administration",
  },
] as const

async function seedDepartments(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
) {
  for (const dept of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: { code: dept.code, description: dept.description },
      create: {
        name: dept.name,
        code: dept.code,
        description: dept.description,
      },
    })
  }
  console.log("Seeded default company departments")
}

async function seedServices(prisma: NonNullable<ReturnType<typeof getPrisma>>) {
  const departmentNames = [
    ...new Set(DEFAULT_SERVICES.map((service) => service.departmentName)),
  ]
  const departments = await prisma.department.findMany({
    where: { name: { in: departmentNames } },
    select: { id: true, name: true },
  })
  const departmentIds = new Map(
    departments.map((department) => [department.name, department.id]),
  )

  for (const service of DEFAULT_SERVICES) {
    const departmentId = departmentIds.get(service.departmentName)
    if (!departmentId) {
      throw new Error(
        `Cannot seed ${service.name}: department ${service.departmentName} was not found`,
      )
    }

    await prisma.service.upsert({
      where: { name: service.name },
      update: {
        description: service.description,
        departments: { set: [{ id: departmentId }] },
      },
      create: {
        name: service.name,
        description: service.description,
        departments: { connect: [{ id: departmentId }] },
        isActive: true,
      },
    })
  }
  console.log(`Seeded ${DEFAULT_SERVICES.length} company services`)
}

async function main() {
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")
  const servicesOnly = process.argv.includes("--services-only")

  try {
    if (!servicesOnly) {
      await seedSuperadmin(prisma)
      await seedAdmin(prisma)
    }
    await seedDepartments(prisma)
    await seedServices(prisma)
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
