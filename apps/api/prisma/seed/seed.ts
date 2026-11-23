import "dotenv/config"
import { Role, type Prisma } from "../../src/generated/prisma/client.js"
import {
  hashPassword,
  validPassword,
} from "../../src/features/auth/auth.password.js"
import { normalizedEmail } from "../../src/shared/validation.js"
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "../../src/shared/password-policy.js"
import { getPrisma } from "../../src/lib/db.js"
import { assertDevSeedTarget, seedDevAccounts } from "./dev-accounts.js"

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

const ADDITIONAL_SERVICES = [
  {
    name: "Marketing Analytics & Reporting",
    description:
      "Set up campaign measurement, build performance dashboards, and identify opportunities based on the results.",
    departmentName: "Marketing",
  },
  {
    name: "Landing Page Optimization",
    description:
      "Improve how visitors use landing pages through a review of page speed, accessibility, and conversion paths.",
    departmentName: "Information Technology",
  },
  {
    name: "Technical SEO Audit",
    description:
      "Review crawlability, indexing, and site structure and deliver a prioritized list of fixes.",
    departmentName: "SEO",
  },
  {
    name: "Customer Onboarding",
    description:
      "Build welcome materials and a handoff process that guide new customers through their first steps.",
    departmentName: "Customer Success",
  },
  {
    name: "Brand Identity Design",
    description:
      "Develop a visual identity with a logo, color palette, typography, and usage guidelines.",
    departmentName: "Advertising",
  },
] as const

function defaultServiceIconKey(name: string) {
  const normalizedName = name.toLocaleLowerCase()
  const rules = [
    { terms: ["social", "community"], iconKey: "social" },
    {
      terms: ["advert", "ads", "paid", "marketing"],
      iconKey: "advertising",
    },
    { terms: ["customer", "support", "business"], iconKey: "business" },
    { terms: ["video", "film", "media"], iconKey: "video" },
    {
      terms: ["website", "web", "development", "software"],
      iconKey: "code",
    },
    { terms: ["search", "seo"], iconKey: "search" },
    { terms: ["email", "newsletter"], iconKey: "email" },
    {
      terms: ["graphic", "design", "brand", "creative"],
      iconKey: "design",
    },
  ]
  return (
    rules.find(({ terms }) =>
      terms.some((term) => normalizedName.includes(term)),
    )?.iconKey ?? "sparkles"
  )
}

async function seedDepartments(
  prisma: Prisma.TransactionClient,
  departments: readonly (typeof DEFAULT_DEPARTMENTS)[number][],
) {
  for (const dept of departments) {
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
}

async function seedServices(
  prisma: Prisma.TransactionClient,
  services: readonly {
    name: string
    description: string
    departmentName: string
  }[],
) {
  const departmentNames = [
    ...new Set(services.map((service) => service.departmentName)),
  ]
  const departments = await prisma.department.findMany({
    where: { name: { in: departmentNames } },
    select: { id: true, name: true },
  })
  const departmentIds = new Map(
    departments.map((department) => [department.name, department.id]),
  )

  for (const service of services) {
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
        iconKey: defaultServiceIconKey(service.name),
        departments: { connect: [{ id: departmentId }] },
        isActive: true,
      },
    })
  }
}

async function main() {
  const devAccountsOnly = process.argv.includes("--dev-accounts")
  if (devAccountsOnly) assertDevSeedTarget(process.env)
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")
  const additionalServicesOnly = process.argv.includes("--additional-services")
  const servicesOnly =
    additionalServicesOnly || process.argv.includes("--services-only")

  try {
    if (devAccountsOnly) {
      const password = process.env.DEV_SEED_PASSWORD
      if (!isStrongPassword(password)) {
        throw new Error(`Set DEV_SEED_PASSWORD. ${PASSWORD_POLICY_MESSAGE}`)
      }
      await seedDevAccounts(prisma, password)
      console.log("Development accounts ready: SUPERADMIN, ADMIN, STAFF, USER")
      return
    }
    if (!servicesOnly) {
      await seedSuperadmin(prisma)
      await seedAdmin(prisma)
    }
    const services = additionalServicesOnly
      ? ADDITIONAL_SERVICES
      : DEFAULT_SERVICES
    const departments = additionalServicesOnly
      ? DEFAULT_DEPARTMENTS.filter((department) =>
          services.some(
            (service) => service.departmentName === department.name,
          ),
        )
      : DEFAULT_DEPARTMENTS

    await prisma.$transaction(
      async (tx) => {
        await seedDepartments(tx, departments)
        await seedServices(tx, services)
      },
      { timeout: 30_000 },
    )
    console.log(`Seeded ${services.length} company services`)
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
