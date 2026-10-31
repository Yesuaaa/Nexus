import { createHash } from "node:crypto"
import { getPrisma } from "../../lib/db.js"
import { appendEvent, lockRequest, workflowAccess } from "./workflow.access.js"
import { fileSelect } from "./workflow.snapshot.js"
import { fail, object, textField, uuid } from "./workflow.validation.js"

const maxSize = 5 * 1024 * 1024
const mimeExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "text/plain": ".txt",
}

function parseFile(input: unknown) {
  const body = object(input)
  const uploadId = uuid(body.uploadId)
  const name = textField(body.name, "file name", 160)
  if (
    /[<>:"/\\|?*]/.test(name) ||
    Array.from(name).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    name.startsWith(".")
  )
    fail("Use a plain file name without directory separators")
  const mimeType = textField(body.mimeType, "file type", 100)
  const extension = mimeExtensions[mimeType]
  if (!extension) fail("Supported files: PDF, PNG, JPEG, and plain text")
  if (
    !(
      mimeType === "image/jpeg"
        ? /\.jpe?g$/i
        : new RegExp(`\\${extension}$`, "i")
    ).test(name)
  )
    fail("The file extension must match its type")
  if (
    typeof body.content !== "string" ||
    body.content.length > Math.ceil(maxSize / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      body.content,
    )
  )
    fail("Invalid or oversized file content")
  const data = Buffer.from(body.content, "base64")
  if (!data.length || data.length > maxSize)
    fail("Files must be between 1 byte and 5 MB")
  if (
    mimeType === "application/pdf" &&
    data.subarray(0, 5).toString() !== "%PDF-"
  )
    fail("Invalid PDF file")
  if (
    mimeType === "image/png" &&
    !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    fail("Invalid PNG file")
  if (
    mimeType === "image/jpeg" &&
    !(data[0] === 255 && data[1] === 216 && data[2] === 255)
  )
    fail("Invalid JPEG file")
  if (
    mimeType === "text/plain" &&
    (data.includes(0) || !Buffer.from(data.toString("utf8")).equals(data))
  )
    fail("Text files must contain valid UTF-8 text")
  return {
    uploadId,
    name,
    mimeType,
    data,
    size: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  }
}

export async function uploadWorkflowFile(
  userId: string,
  requestId: string,
  input: unknown,
) {
  const parsed = parseFile(input)
  return getPrisma()!.$transaction(
    async (tx) => {
      await lockRequest(tx, requestId)
      const { request, permissions } = await workflowAccess(
        tx,
        userId,
        requestId,
      )
      if (
        !permissions.manage &&
        !permissions.isClient &&
        !permissions.verifyPayment
      )
        fail("File uploads require participant or agreement authorization", 403)
      if (
        !request.workflow ||
        ["PENDING_REVIEW", "CANCELLED", "DECLINED", "ON_HOLD"].includes(
          request.workflow.state,
        ) ||
        ["CLOSED", "CANCELLED"].includes(request.status)
      )
        fail("File submissions are unavailable at this stage", 409)
      const existing = await tx.workflowFile.findUnique({
        where: {
          requestId_uploaderId_uploadId: {
            requestId,
            uploaderId: userId,
            uploadId: parsed.uploadId,
          },
        },
      })
      if (existing) {
        if (
          existing.sha256 !== parsed.sha256 ||
          existing.name !== parsed.name ||
          existing.mimeType !== parsed.mimeType
        )
          fail("This upload ID was already used for another file", 409)
        const {
          data: _data,
          sha256: _sha256,
          requestId: _requestId,
          uploadId: _uploadId,
          clientVisible: _clientVisible,
          ...safe
        } = existing
        void _data
        void _sha256
        void _requestId
        void _uploadId
        void _clientVisible
        return safe
      }
      const total = await tx.workflowFile.aggregate({
        where: { requestId },
        _sum: { size: true },
        _count: true,
      })
      if (
        total._count >= 100 ||
        (total._sum.size ?? 0) + parsed.size > 100 * 1024 * 1024
      )
        fail("This request has reached its attachment allowance", 409)
      const file = await tx.workflowFile.create({
        data: {
          ...parsed,
          requestId,
          uploaderId: userId,
          clientVisible: permissions.isClient || permissions.manage,
        },
        select: fileSelect,
      })
      await tx.requestWorkflow.update({
        where: { requestId },
        data: { version: { increment: 1 } },
      })
      // An approver's unlinked financial document is not a client-facing upload.
      await appendEvent(
        tx,
        requestId,
        userId,
        permissions.isClient || permissions.manage
          ? "FILE_SUBMITTED"
          : "PAYMENT_DOCUMENT_UPLOADED",
        `File submitted: ${file.name}`,
        file.id,
        !permissions.isClient && !permissions.manage,
      )
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: { updatedAt: new Date() },
      })
      return file
    },
    { timeout: 20_000 },
  )
}

export async function downloadWorkflowFile(
  userId: string,
  requestId: string,
  fileId: string,
) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const { permissions } = await workflowAccess(tx, userId, requestId)
      const file = await tx.workflowFile.findFirst({
        where: {
          id: fileId,
          requestId,
          ...(permissions.isClient ? { clientVisible: true } : {}),
          ...(!permissions.isClient && !permissions.manage
            ? {
                OR: [
                  ...(permissions.verifyPayment
                    ? [
                        { agreements: { some: { requestId } } },
                        { signatures: { some: { requestId } } },
                        { payments: { some: { requestId } } },
                      ]
                    : []),
                  { uploaderId: userId },
                ],
              }
            : {}),
        },
      })
      if (!file) fail("File not found", 404)
      return file
    },
    { isolationLevel: "RepeatableRead" },
  )
}
