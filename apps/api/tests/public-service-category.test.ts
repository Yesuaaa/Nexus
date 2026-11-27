import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "public service categories filter before pagination and exclude inactive services",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    await prisma.service.createMany({
      data: [
        ...Array.from({ length: 13 }, (_, index) => ({
          name: `Web ${String(index).padStart(2, "0")}`,
          description: "Website",
          iconKey: "code",
        })),
        { name: "Design", description: "Website", iconKey: "design" },
        {
          name: "Inactive",
          description: "Website",
          iconKey: "code",
          isActive: false,
        },
      ],
    })
    const response = await fetch(
      `${origin}/api/public/services?q=Website&category=code&page=2`,
    )
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      total: number
      services: { name: string; iconKey: string }[]
    }
    assert.equal(body.total, 13)
    assert.deepEqual(
      body.services.map((service) => service.name),
      ["Web 12"],
    )
    assert.equal(body.services[0]?.iconKey, "code")
    const invalid = await fetch(
      `${origin}/api/public/services?category=invalid`,
    )
    assert.equal(invalid.status, 400)
  },
)
