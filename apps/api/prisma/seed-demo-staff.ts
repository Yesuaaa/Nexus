// Seeds demo staff and teams into the Administration department.
// Safe to re-run: existing teams are reused and existing emails are skipped.
// Demo accounts use @example.com addresses and random passwords (not printed),
// so they appear in the UI but cannot be signed into.
import "dotenv/config"
import { randomBytes } from "node:crypto"
import { EmploymentType, Role } from "../src/generated/prisma/client.js"
import { hashPassword } from "../src/features/auth/auth.password.js"
import { createEmployee } from "../src/features/employees/employees.service.js"
import { getPrisma } from "../src/lib/db.js"

const DEPARTMENT = "Administration"

const TEAMS = [
  {
    name: "Quality Assurance Team",
    description:
      "Reviews deliverables and internal processes against standards.",
  },
  {
    name: "Facilities & Operations",
    description: "Office facilities, equipment, and day-to-day operations.",
  },
  {
    name: "People & Culture",
    description: "Recruitment, onboarding, and employee engagement.",
  },
] as const

type TeamName = (typeof TEAMS)[number]["name"]

const PEOPLE: {
  fullName: string
  email: string
  position: string
  team: TeamName | null
  employmentType?: EmploymentType
  startDate: string
}[] = [
  {
    fullName: "Andrea Villanueva",
    email: "andrea.villanueva@example.com",
    position: "QA Specialist",
    team: "Quality Assurance Team",
    startDate: "2024-02-12",
  },
  {
    fullName: "Miguel Santos",
    email: "miguel.santos@example.com",
    position: "QA Analyst",
    team: "Quality Assurance Team",
    startDate: "2024-06-03",
  },
  {
    fullName: "Bea Ramirez",
    email: "bea.ramirez@example.com",
    position: "Process Auditor",
    team: "Quality Assurance Team",
    startDate: "2025-01-20",
  },
  {
    fullName: "Paolo Mendoza",
    email: "paolo.mendoza@example.com",
    position: "QA Associate",
    team: "Quality Assurance Team",
    employmentType: EmploymentType.INTERN,
    startDate: "2026-06-01",
  },
  {
    fullName: "Carla Dizon",
    email: "carla.dizon@example.com",
    position: "Operations Coordinator",
    team: "Facilities & Operations",
    startDate: "2023-09-11",
  },
  {
    fullName: "Rafael Cruz",
    email: "rafael.cruz@example.com",
    position: "Facilities Officer",
    team: "Facilities & Operations",
    startDate: "2024-11-04",
  },
  {
    fullName: "Janelle Torres",
    email: "janelle.torres@example.com",
    position: "Office Administrator",
    team: "Facilities & Operations",
    employmentType: EmploymentType.PART_TIME,
    startDate: "2025-08-18",
  },
  {
    fullName: "Kevin Bautista",
    email: "kevin.bautista@example.com",
    position: "HR Generalist",
    team: "People & Culture",
    startDate: "2024-03-25",
  },
  {
    fullName: "Trisha Navarro",
    email: "trisha.navarro@example.com",
    position: "Recruitment Specialist",
    team: "People & Culture",
    employmentType: EmploymentType.CONTRACT,
    startDate: "2025-10-06",
  },
  {
    fullName: "Luis Garcia",
    email: "luis.garcia@example.com",
    position: "Administrative Assistant",
    team: null,
    startDate: "2026-02-16",
  },
]

async function main() {
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")

  try {
    const department = await prisma.department.findUnique({
      where: { name: DEPARTMENT },
      select: { id: true },
    })
    if (!department) throw new Error(`Department "${DEPARTMENT}" not found`)

    const teamIds = new Map<string, string>()
    for (const team of TEAMS) {
      const saved = await prisma.team.upsert({
        where: {
          departmentId_name: { departmentId: department.id, name: team.name },
        },
        update: {},
        create: { ...team, departmentId: department.id },
        select: { id: true },
      })
      teamIds.set(team.name, saved.id)
    }

    let created = 0
    for (const person of PEOPLE) {
      if (await prisma.user.findUnique({ where: { email: person.email } })) {
        console.log(`Exists, skipped: ${person.email}`)
        continue
      }
      const passwordHash = await hashPassword(
        randomBytes(24).toString("base64url"),
      )
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: person.email,
            fullName: person.fullName,
            passwordHash,
            role: Role.STAFF,
          },
        })
        await createEmployee(tx, {
          fullName: person.fullName,
          email: person.email,
          position: person.position,
          employmentType: person.employmentType ?? EmploymentType.FULL_TIME,
          startDate: new Date(person.startDate),
          departmentId: department.id,
          teamId: person.team ? teamIds.get(person.team)! : null,
          userId: user.id,
        })
      })
      created++
      console.log(
        `Created: ${person.fullName} -> ${person.team ?? "(no team)"}`,
      )
    }
    console.log(
      `Done: ${created} people created, ${TEAMS.length} teams ensured`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
