CREATE TYPE "ServiceInquiryStatus" AS ENUM ('PENDING', 'CONTACTED', 'CLOSED', 'SPAM');

CREATE TABLE "ServiceInquiry" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "fullName" VARCHAR(100) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "contactNumber" VARCHAR(24) NOT NULL,
  "subject" VARCHAR(160) NOT NULL,
  "message" VARCHAR(6000) NOT NULL,
  "submissionKey" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "status" "ServiceInquiryStatus" NOT NULL DEFAULT 'PENDING',
  "internalNote" VARCHAR(2000),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceInquiry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceInquiry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceInquiry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceInquiry_submissionKey_key" ON "ServiceInquiry"("submissionKey");
CREATE INDEX "ServiceInquiry_status_createdAt_id_idx" ON "ServiceInquiry"("status", "createdAt", "id");
CREATE INDEX "ServiceInquiry_serviceId_createdAt_idx" ON "ServiceInquiry"("serviceId", "createdAt");
CREATE INDEX "ServiceInquiry_email_createdAt_idx" ON "ServiceInquiry"("email", "createdAt");
CREATE INDEX "ServiceInquiry_fingerprint_createdAt_idx" ON "ServiceInquiry"("fingerprint", "createdAt");
