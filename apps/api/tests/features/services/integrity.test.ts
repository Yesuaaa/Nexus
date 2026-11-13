import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { validateServiceInput } from "../../../src/features/services/services.schema.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "service persistence keeps request history and honors validated pricing limits",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "services-admin@example.test",
        fullName: "Services Admin",
        role: "ADMIN",
        passwordHash: "unused-test-hash",
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "services-client@example.test",
        fullName: "Services Client",
        role: "USER",
        passwordHash: "unused-test-hash",
      },
    })
    const department = await prisma.department.create({
      data: { name: "Services Test Department", code: "SVC" },
    })
    const token = (await issueSession(admin)).token

    async function request(path: string, method: string, body?: unknown) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }

    await t.test(
      "inactive services remain undeletable while service requests reference them",
      async () => {
        const created = await request("/services", "POST", {
          name: "History Retained Service",
          description: "Service with a historical request",
          departmentIds: [department.id],
          isActive: true,
        })
        assert.equal(created.status, 201)
        const { service } = (await created.json()) as {
          service: { id: string }
        }
        const serviceRequest = await prisma.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            title: "Previously submitted request",
          },
        })

        const deactivated = await request(
          `/services/${service.id}/status`,
          "PATCH",
          {
            isActive: false,
          },
        )
        assert.equal(deactivated.status, 200)

        const rejectedDeletion = await request(
          `/services/${service.id}`,
          "DELETE",
        )
        assert.equal(rejectedDeletion.status, 409)
        assert.deepEqual(await rejectedDeletion.json(), {
          error:
            "This service cannot be deleted because existing records use it",
        })
        assert.equal(
          (await prisma.service.findUnique({ where: { id: service.id } }))?.id,
          service.id,
        )
        assert.equal(
          (
            await prisma.serviceRequest.findUnique({
              where: { id: serviceRequest.id },
            })
          )?.serviceId,
          service.id,
        )

        await prisma.serviceRequest.delete({ where: { id: serviceRequest.id } })
        const deleted = await request(`/services/${service.id}`, "DELETE")
        assert.equal(deleted.status, 200)
        assert.equal(
          await prisma.service.findUnique({ where: { id: service.id } }),
          null,
        )
      },
    )

    await t.test("pricing at the Decimal(12,2) maximum persists", async () => {
      const input = {
        name: "Database Decimal Maximum Service",
        description: "Pricing at the database decimal maximum",
        departmentIds: [department.id],
        isActive: true,
        pricingTemplate: {
          name: "Database Decimal Maximum Template",
          pricingModel: "FIXED",
          currency: "PHP",
          amount: 9_999_999_999.99,
          billingInterval: null,
          isPublic: true,
        },
      }
      assert.equal(validateServiceInput(input).error, undefined)

      const response = await request("/services", "POST", input)
      const result = {
        status: response.status,
        serviceCount: await prisma.service.count({
          where: { name: input.name },
        }),
        templateCount: await prisma.pricingTemplate.count({
          where: { name: input.pricingTemplate.name },
        }),
      }
      assert.deepEqual(result, {
        status: 201,
        serviceCount: 1,
        templateCount: 1,
      })
    })

    await t.test(
      "pricing above the Decimal(12,2) maximum is rejected before persistence",
      async () => {
        const input = {
          name: "Out of Range Service",
          description: "Pricing above the database decimal maximum",
          departmentIds: [department.id],
          isActive: true,
          pricingTemplate: {
            name: "Out of Range Template",
            pricingModel: "FIXED",
            currency: "PHP",
            amount: 10_000_000_000,
            billingInterval: null,
            isPublic: true,
          },
        }
        assert.equal(validateServiceInput(input).error, undefined)

        const response = await request("/services", "POST", input)
        const result = {
          status: response.status,
          serviceCount: await prisma.service.count({
            where: { name: input.name },
          }),
          templateCount: await prisma.pricingTemplate.count({
            where: { name: input.pricingTemplate.name },
          }),
        }
        assert.deepEqual(
          result,
          { status: 400, serviceCount: 0, templateCount: 0 },
          "Out-of-range pricing should be rejected as invalid input instead of failing during persistence",
        )
      },
    )
  },
)
