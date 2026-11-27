import { createHash, randomUUID } from "node:crypto"
import type {
  PrismaClient,
  Role,
  WorkflowPaymentStatus,
  ServiceRequestStatus,
} from "../../src/generated/prisma/client.js"
import { issueSession } from "../../src/features/auth/auth.service.js"

export const proofBytes = Buffer.from(
  "PG-016 synthetic protected receipt. No financial transaction.",
)
export async function seedBilling(prisma: PrismaClient) {
  async function account(name: string, role: Role = "USER") {
    const user = await prisma.user.create({
      data: {
        email: name + "@pg016.test",
        fullName: name,
        role,
        passwordHash: "fixture",
      },
    })
    return { user, token: (await issueSession(user)).token }
  }
  const a = await account("client-a")
  const b = await account("client-b")
  const service = await prisma.service.create({
    data: {
      name: "PG-016 design service",
      description: "Synthetic billing fixture",
    },
  })
  async function payment(
    ownerId: string,
    name: string,
    options: {
      amount?: string
      status?: WorkflowPaymentStatus
      requestStatus?: ServiceRequestStatus
      verifiedAt?: Date
      verifiedById?: string
      reference?: string
      visible?: boolean
    } = {},
  ) {
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: ownerId,
        serviceId: service.id,
        title: name,
        referenceNumber: "PG016-" + name,
        status: options.requestStatus,
        workflow: { create: {} },
      },
    })
    const file = await prisma.workflowFile.create({
      data: {
        requestId: request.id,
        uploaderId: ownerId,
        uploadId: randomUUID(),
        name: "PG016-" + name + ".txt",
        mimeType: "text/plain",
        size: proofBytes.length,
        sha256: createHash("sha256").update(proofBytes).digest("hex"),
        data: proofBytes,
        clientVisible: options.visible ?? true,
      },
    })
    const row = await prisma.workflowPayment.create({
      data: {
        requestId: request.id,
        amount: options.amount ?? "125.07",
        currency: "PHP",
        status: options.status ?? "SUBMITTED",
        proofFileId: file.id,
        reference: options.reference ?? "PG016-REFERENCE-" + name,
        verifiedAt: options.verifiedAt,
        verifiedById: options.verifiedById,
      },
    })
    return { request, file, payment: row }
  }
  const own = await payment(a.user.id, "own")
  const foreign = await payment(b.user.id, "foreign", { amount: "987.65" })
  return { a, b, own, foreign, account, payment, service }
}
