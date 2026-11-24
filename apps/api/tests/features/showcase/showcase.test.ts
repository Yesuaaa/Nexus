import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteDatabase } from "../../support/pglite-app.js"
import {
  assertShowcaseTarget,
  showcaseId,
} from "../../../prisma/seed/showcase-plan.js"
import { seedShowcase } from "../../../prisma/seed/showcase-core.js"
import { cleanupShowcase } from "../../../prisma/seed/showcase-cleanup.js"
import { invoiceSummary } from "../../../src/features/billing/billing-summary.js"
import { billingOverview } from "../../../src/features/billing/billing-overview.js"
import { listClientInvoices } from "../../../src/features/billing/client-invoices.js"
import { listClientCalendar } from "../../../src/features/projects/client-calendar.service.js"
import { listConversations } from "../../../src/features/request-conversations/request-conversations.service.js"
import { listInternalConversations } from "../../../src/features/internal-conversations/internal-conversations.service.js"

const env = (url: string) => ({ NODE_ENV: "development", DATABASE_URL: url })
test("showcase targets are restricted to explicitly named local databases", () => {
  assert.equal(
    assertShowcaseTarget(
      env(
        "postgresql://demo:secret@127.0.0.1:5432/nexus_showcase?sslmode=disable",
      ),
    ).database,
    "nexus_showcase",
  )
  for (const value of [
    "postgresql://example.com/nexus_dev",
    "postgresql://127.0.0.1/production",
    "postgresql://db/nexus_dev",
    "postgresql://127.0.0.1/nexus_dev?sslmode=require",
  ])
    assert.throws(() => assertShowcaseTarget(env(value)))
  assert.throws(() =>
    assertShowcaseTarget({
      ...env("postgresql://localhost/nexus_dev"),
      NODE_ENV: "production",
    }),
  )
  assert.throws(() =>
    assertShowcaseTarget({
      ...env("postgresql://localhost/nexus_dev"),
      DIRECT_URL: "postgresql://localhost/production",
    }),
  )
})

test(
  "showcase data is linked, repeatable, financially consistent and protected on cleanup",
  { timeout: 120_000 },
  async (t) => {
    const { prisma } = await startPgliteDatabase(t)
    await prisma.user.create({
      data: {
        id: "existing-head",
        email: "head@existing.invalid",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    await prisma.department.create({
      data: {
        id: "existing-department",
        name: "Existing Department",
        headId: "existing-head",
      },
    })
    await prisma.service.create({
      data: {
        id: "existing-service",
        name: "Website Design",
        description: "Existing catalog entry",
        departments: { connect: { id: "existing-department" } },
      },
    })
    await prisma.servicePackage.create({
      data: {
        id: "existing-package",
        serviceId: "existing-service",
        name: "Existing offer",
        description: "Already configured",
        pricingModel: "FIXED",
        amount: "9000.00",
      },
    })
    await prisma.$executeRawUnsafe("CREATE SCHEMA realtime")
    await prisma.$executeRawUnsafe(
      "CREATE FUNCTION realtime.send(jsonb, text, text, boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$",
    )
    await assert.rejects(
      () => seedShowcase(prisma, "IllustrativeStrongPass1!"),
      /realtime broadcasts are enabled/,
    )
    assert.equal(
      await prisma.user.count({
        where: { email: { endsWith: "@showcase.invalid" } },
      }),
      0,
    )
    await prisma.$executeRawUnsafe("DROP SCHEMA realtime CASCADE")
    const first = await seedShowcase(
      prisma,
      "IllustrativeStrongPass1!",
      new Date("2026-11-24T08:00:00Z"),
    )
    assert.equal(first.created, true)
    assert.equal(
      await prisma.internalConversation.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      4,
    )
    assert.equal(
      await prisma.internalMessage.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      8,
    )
    assert.equal(
      await prisma.requestConversation.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      12,
    )
    assert.equal(
      await prisma.serviceRequestMessage.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      24,
    )
    assert.equal(
      await prisma.servicePackage.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      18,
    )
    assert.equal(
      await prisma.serviceInquiry.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      9,
    )
    assert.equal(
      await prisma.user.count({
        where: { email: { endsWith: "@showcase.invalid" } },
      }),
      34,
    )
    assert.equal(
      await prisma.serviceRequest.count({
        where: { id: { startsWith: "showcase-2026-" } },
      }),
      36,
    )
    assert.equal(
      await prisma.project.count({
        where: { clientId: showcaseId("user", 22) },
      }),
      4,
    )
    assert.equal(
      (
        await seedShowcase(
          prisma,
          "DifferentStrongPass1!",
          new Date("2026-11-24T08:00:00Z"),
        )
      ).created,
      false,
    )
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: showcaseId("invoice", 6) },
      include: { payments: true, workflowPayment: true },
    })
    const summary = invoiceSummary(invoice)
    assert.equal(summary.displayStatus, "PAID")
    assert.equal(summary.outstanding, "0.00")
    const overview = await billingOverview()
    const issued = await prisma.invoice.aggregate({
      where: { status: "ISSUED", id: { startsWith: "showcase-2026-" } },
      _sum: { total: true },
    })
    const payments = await prisma.invoicePayment.aggregate({
      where: { id: { startsWith: "showcase-2026-" } },
      _sum: { amount: true },
    })
    assert.equal(overview.totals.invoiced, issued._sum.total?.toFixed(2))
    assert.equal(overview.totals.collected, payments._sum.amount?.toFixed(2))
    const clientInvoices = await listClientInvoices(showcaseId("user", 22))
    assert.ok(clientInvoices.length > 0)
    assert.ok(clientInvoices.every((row) => row.status === "ISSUED"))
    const calendar = await listClientCalendar(showcaseId("user", 22))
    assert.equal(
      calendar.filter((row) => row.type === "consultation").length,
      4,
    )
    const clientConversations = await listConversations(showcaseId("user", 22))
    assert.equal(clientConversations.conversations.length, 1)
    assert.ok(clientConversations.conversations[0]?.lastMessage)
    const staffConversations = await listInternalConversations(
      showcaseId("user", 2),
    )
    assert.equal(staffConversations.conversations.length, 1)
    assert.ok(staffConversations.conversations[0]?.lastMessage)
    await prisma.projectMessage.create({
      data: {
        id: "external-message",
        projectId: showcaseId("project", 0),
        senderId: showcaseId("user", 22),
        clientMessageId: "b21ebc3f-c05e-4cbe-a984-a91397528148",
        body: "An externally created client message",
      },
    })
    await assert.rejects(() => cleanupShowcase(prisma), /outside the fixture/)
    assert.equal(
      await prisma.projectMessage.count({ where: { id: "external-message" } }),
      1,
    )
    await prisma.projectMessage.delete({ where: { id: "external-message" } })
    await cleanupShowcase(prisma)
    assert.equal((await cleanupShowcase(prisma)).removed, false)
    assert.equal(
      await prisma.user.count({
        where: { email: { endsWith: "@showcase.invalid" } },
      }),
      0,
    )
    assert.ok(
      await prisma.service.findUnique({ where: { id: "existing-service" } }),
    )
    assert.ok(
      await prisma.servicePackage.findUnique({
        where: { id: "existing-package" },
      }),
    )
    await prisma.$executeRawUnsafe('DROP TABLE "ServiceInquiry"')
    await assert.rejects(
      () => seedShowcase(prisma, "IllustrativeStrongPass1!"),
      /missing the service inquiry migration/,
    )
    assert.equal(
      await prisma.user.count({
        where: { email: { endsWith: "@showcase.invalid" } },
      }),
      0,
    )
  },
)
