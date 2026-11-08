import "dotenv/config"
import {
  BillingInterval,
  EmployeeStatus,
  PricingModel,
  Role,
} from "../src/generated/prisma/client.js"
import {
  hashPassword,
  validPassword,
} from "../src/features/auth/auth.password.js"
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
      "Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD meeting the password policy to seed the first Superadmin",
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
  if (!email) return

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

  if (!validPassword(password)) {
    throw new Error(
      "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD meeting the password policy to seed an Admin",
    )
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

async function seedTestClient(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
) {
  const email = "client@nexus.com"
  const password = "Client1234!"
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) {
    console.log(`Test client already exists: ${email}; seed skipped`)
    return
  }

  await prisma.user.create({
    data: {
      email,
      fullName: "Nexus Test Client",
      contactNumber: "09123456789",
      passwordHash: await hashPassword(password),
      role: Role.USER,
      isActive: true,
    },
  })
  console.log(`Created Test Client: ${email}`)
}

async function seedSpecialists(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
) {
  const specialists = [
    {
      employeeId: "EMP-IT-001",
      fullName: "Alex Rivera",
      email: "alex.it@nexus.com",
      position: "Senior Full-Stack Developer & UI/UX Specialist",
      departmentCode: "IT",
      profileBio:
        "Experienced full-stack engineer and interface architect specializing in high-performance web and mobile platforms.",
      profileSpecialties: [
        "UI/UX Design",
        "React",
        "Next.js",
        "KMP",
        "Node.js",
      ],
    },
    {
      employeeId: "EMP-MKT-001",
      fullName: "Sophia Chen",
      email: "sophia.mkt@nexus.com",
      position: "Growth Marketing Lead & Content Strategist",
      departmentCode: "MKT",
      profileBio:
        "Brand strategist with 8+ years scaling organic reach and multichannel social engagement campaigns.",
      profileSpecialties: [
        "Content Strategy",
        "Social Media",
        "Community Growth",
        "Brand Identity",
      ],
    },
    {
      employeeId: "EMP-ADV-001",
      fullName: "Marcus Vance",
      email: "marcus.adv@nexus.com",
      position: "Senior Paid Ads Strategist & Media Planner",
      departmentCode: "ADV",
      profileBio:
        "Performance marketer focused on high-ROAS paid media across Meta, Google Ads, and programmatic networks.",
      profileSpecialties: [
        "Meta Ads",
        "Google Ads",
        "Conversion Rate Optimization",
        "ROAS Scaling",
      ],
    },
    {
      employeeId: "EMP-SEO-001",
      fullName: "Elena Cruz",
      email: "elena.seo@nexus.com",
      position: "Technical SEO Specialist & Analytics Consultant",
      departmentCode: "SEO",
      profileBio:
        "Technical search specialist driving organic visibility through indexing optimization, content clusters, and keyword mastery.",
      profileSpecialties: [
        "Technical SEO",
        "Keyword Strategy",
        "Google Search Console",
        "Core Web Vitals",
      ],
    },
  ]

  const passwordHash = await hashPassword("Specialist123!")

  for (const s of specialists) {
    const dept = await prisma.department.findUnique({
      where: { code: s.departmentCode },
      select: { id: true },
    })
    if (!dept) continue

    const existingUser = await prisma.user.findUnique({
      where: { email: s.email },
      select: { id: true },
    })
    if (existingUser) continue

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: s.email,
          fullName: s.fullName,
          position: s.position,
          passwordHash,
          role: Role.STAFF,
          isActive: true,
          departmentId: dept.id,
        },
      })

      await tx.employee.create({
        data: {
          employeeId: s.employeeId,
          fullName: s.fullName,
          email: s.email,
          position: s.position,
          departmentId: dept.id,
          userId: user.id,
          status: EmployeeStatus.ACTIVE,
          profileBio: s.profileBio,
          profileSpecialties: s.profileSpecialties,
        },
      })
    })
    console.log(`Created specialist: ${s.fullName} (${s.email})`)
  }
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
        iconKey: defaultServiceIconKey(service.name),
        departments: { connect: [{ id: departmentId }] },
        isActive: true,
      },
    })
  }
  console.log(`Seeded ${DEFAULT_SERVICES.length} company services`)
}

interface PackageSeedItem {
  name: string
  description: string
  includedFeatures: string[]
  pricingModel: PricingModel
  currency: string
  amount: number
  billingInterval: BillingInterval | null
  isPricingPublic: boolean
  displayOrder: number
  isRecommended: boolean
}

interface BenefitSeedItem {
  title: string
  description: string
  displayOrder: number
}

const SERVICE_PACKAGE_AND_BENEFIT_SEEDS: Record<
  string,
  { packages: PackageSeedItem[]; benefits: BenefitSeedItem[] }
> = {
  "Website Design & Development": {
    benefits: [
      {
        title: "High Performance",
        description:
          "Blazing fast page loads and optimized Core Web Vitals for superior user experience.",
        displayOrder: 1,
      },
      {
        title: "Responsive Architecture",
        description:
          "Pixel-perfect rendering across Android, iOS, tablets, and desktop displays.",
        displayOrder: 2,
      },
      {
        title: "Built-in Security",
        description:
          "Enterprise-grade HTTPS and robust input validation out of the box.",
        displayOrder: 3,
      },
    ],
    packages: [
      {
        name: "Starter Web",
        description:
          "Essential single-page website or high-converting landing page.",
        includedFeatures: [
          "1 High-Converting Landing Page",
          "Mobile & Tablet Responsive",
          "Contact Form & Lead Capture",
          "1 Round of Revisions",
          "14-Day Delivery",
        ],
        pricingModel: PricingModel.FIXED,
        currency: "PHP",
        amount: 15000,
        billingInterval: null,
        isPricingPublic: true,
        displayOrder: 1,
        isRecommended: false,
      },
      {
        name: "Business Pro",
        description:
          "Multi-page business website with CMS and search engine optimization.",
        includedFeatures: [
          "Up to 5 Custom Pages",
          "CMS Content Management",
          "On-Page SEO Optimization",
          "Fast Load Time Guarantee",
          "3 Rounds of Revisions",
          "30-Day Delivery",
        ],
        pricingModel: PricingModel.FIXED,
        currency: "PHP",
        amount: 35000,
        billingInterval: null,
        isPricingPublic: true,
        displayOrder: 2,
        isRecommended: true,
      },
      {
        name: "Enterprise Portal",
        description:
          "Custom web platform with authentication, dashboards, and database integrations.",
        includedFeatures: [
          "Custom Web Application",
          "Role-Based Authentication",
          "Admin Dashboard & Database",
          "Third-Party API Integrations",
          "Priority SLA & Dedicated PM",
        ],
        pricingModel: PricingModel.FIXED,
        currency: "PHP",
        amount: 75000,
        billingInterval: null,
        isPricingPublic: true,
        displayOrder: 3,
        isRecommended: false,
      },
    ],
  },
  "Social Media Management": {
    benefits: [
      {
        title: "Visual Consistency",
        description:
          "Distinctive brand aesthetics that make your feed memorable and professional.",
        displayOrder: 1,
      },
      {
        title: "Audience Engagement",
        description:
          "Meaningful interactions and comment moderation that convert followers into clients.",
        displayOrder: 2,
      },
      {
        title: "Data-Driven Strategy",
        description:
          "Monthly analytics reports detailing growth, engagement, and reach metrics.",
        displayOrder: 3,
      },
    ],
    packages: [
      {
        name: "Growth Starter",
        description:
          "Consistent baseline presence across major social networks.",
        includedFeatures: [
          "12 Curated Posts per Month",
          "Caption & Hashtag Strategy",
          "Monthly Performance Analytics",
          "Community Engagement",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 12000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 1,
        isRecommended: false,
      },
      {
        name: "Brand Accelerator",
        description:
          "Aggressive audience growth with video reels and targeted campaigns.",
        includedFeatures: [
          "24 Posts & Short-form Reels",
          "Custom Graphic Templates",
          "Paid Ad Campaign Setup",
          "Weekly Growth Reports",
          "Comment Moderation",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 25000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 2,
        isRecommended: true,
      },
      {
        name: "Full Scale Dominance",
        description:
          "Omnichannel social presence with daily content and influencer collaborations.",
        includedFeatures: [
          "Daily Multi-Platform Content",
          "Short-Form Video Production",
          "Influencer Outreach & Collabs",
          "Dedicated Account Manager",
          "24/7 Crisis Monitoring",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 50000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 3,
        isRecommended: false,
      },
    ],
  },
  "Paid Ads Management": {
    benefits: [
      {
        title: "High ROAS Focus",
        description:
          "Every campaign dollar is optimized for return on ad spend and conversions.",
        displayOrder: 1,
      },
      {
        title: "Audience Segmentation",
        description:
          "Precision targeting to reach your most profitable customer demographics.",
        displayOrder: 2,
      },
      {
        title: "Transparent Attribution",
        description:
          "Clear conversion tracking and real-time dashboard visibility.",
        displayOrder: 3,
      },
    ],
    packages: [
      {
        name: "Campaign Launch",
        description: "Setup and initial testing on Meta or Google Ads.",
        includedFeatures: [
          "1 Advertising Platform (Meta/Google)",
          "Audience Research & Pixel Setup",
          "2 Ad Creative Variants",
          "Bi-Weekly Reporting",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 18000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 1,
        isRecommended: false,
      },
      {
        name: "Scale & Optimize",
        description:
          "Multichannel funnels with ongoing conversion rate optimization.",
        includedFeatures: [
          "Meta & Google Ads Management",
          "Custom Retargeting Funnels",
          "A/B Creative & Copy Testing",
          "ROAS Optimization",
          "Weekly Strategy Calls",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 38000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 2,
        isRecommended: true,
      },
      {
        name: "Enterprise Performance",
        description:
          "High-budget ad operations with dedicated media buyer and creative team.",
        includedFeatures: [
          "Omnichannel Ad Funnels",
          "Custom Analytics & Attribution",
          "High-Volume Creative Iteration",
          "Dedicated Media Buyer",
          "Real-Time Dashboard Access",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 70000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 3,
        isRecommended: false,
      },
    ],
  },
  "Search Engine Optimization (SEO)": {
    benefits: [
      {
        title: "Sustainable Traffic",
        description:
          "Organic rankings that drive customers month after month without ad spend.",
        displayOrder: 1,
      },
      {
        title: "Technical Authority",
        description:
          "Resolves indexing, schema, and Core Web Vitals bottlenecks on Google.",
        displayOrder: 2,
      },
      {
        title: "Content Dominance",
        description:
          "Comprehensive topical clusters that rank for high-intent search terms.",
        displayOrder: 3,
      },
    ],
    packages: [
      {
        name: "Technical Audit & Fixes",
        description: "Full architectural and on-page technical optimization.",
        includedFeatures: [
          "Comprehensive Site Audit",
          "Core Web Vitals Optimization",
          "Sitemap & Robots.txt Fixes",
          "Broken Links & Redirection Repair",
        ],
        pricingModel: PricingModel.FIXED,
        currency: "PHP",
        amount: 15000,
        billingInterval: null,
        isPricingPublic: true,
        displayOrder: 1,
        isRecommended: false,
      },
      {
        name: "Monthly Organic Growth",
        description:
          "Ongoing keyword ranking, content creation, and authority building.",
        includedFeatures: [
          "Keyword Strategy & Tracking",
          "4 Optimized Blog Articles / Month",
          "Backlink Acquisition",
          "Monthly Search Console Reporting",
          "Competitor Gap Analysis",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 28000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 2,
        isRecommended: true,
      },
      {
        name: "Market Leader SEO",
        description:
          "Dominant enterprise search positioning for competitive niches.",
        includedFeatures: [
          "Full Industry Search Domination",
          "8 Long-Form Content Assets",
          "High-Authority Digital PR Links",
          "International / Local Multi-Location SEO",
          "Dedicated SEO Director",
        ],
        pricingModel: PricingModel.RECURRING,
        currency: "PHP",
        amount: 55000,
        billingInterval: BillingInterval.MONTHLY,
        isPricingPublic: true,
        displayOrder: 3,
        isRecommended: false,
      },
    ],
  },
}

async function seedServicePackagesAndBenefits(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
) {
  for (const [serviceName, data] of Object.entries(
    SERVICE_PACKAGE_AND_BENEFIT_SEEDS,
  )) {
    const service = await prisma.service.findUnique({
      where: { name: serviceName },
      select: { id: true },
    })
    if (!service) continue

    for (const pkg of data.packages) {
      await prisma.servicePackage.upsert({
        where: {
          serviceId_name: {
            serviceId: service.id,
            name: pkg.name,
          },
        },
        update: {
          description: pkg.description,
          includedFeatures: pkg.includedFeatures,
          pricingModel: pkg.pricingModel,
          currency: pkg.currency,
          amount: pkg.amount,
          billingInterval: pkg.billingInterval,
          isPricingPublic: pkg.isPricingPublic,
          displayOrder: pkg.displayOrder,
          isRecommended: pkg.isRecommended,
          isActive: true,
        },
        create: {
          serviceId: service.id,
          name: pkg.name,
          description: pkg.description,
          includedFeatures: pkg.includedFeatures,
          pricingModel: pkg.pricingModel,
          currency: pkg.currency,
          amount: pkg.amount,
          billingInterval: pkg.billingInterval,
          isPricingPublic: pkg.isPricingPublic,
          displayOrder: pkg.displayOrder,
          isRecommended: pkg.isRecommended,
          isActive: true,
        },
      })
    }

    const count = await prisma.serviceBenefit.count({
      where: { serviceId: service.id },
    })
    if (count === 0) {
      await prisma.serviceBenefit.createMany({
        data: data.benefits.map((b) => ({
          serviceId: service.id,
          title: b.title,
          description: b.description,
          displayOrder: b.displayOrder,
        })),
      })
    }
  }
  console.log("Seeded tiered packages and key benefits for core services")
}

async function main() {
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")
  const servicesOnly = process.argv.includes("--services-only")

  try {
    await seedDepartments(prisma)
    await seedServices(prisma)
    await seedServicePackagesAndBenefits(prisma)
    if (!servicesOnly) {
      await seedSuperadmin(prisma)
      await seedAdmin(prisma)
      await seedTestClient(prisma)
      await seedSpecialists(prisma)
    }
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
