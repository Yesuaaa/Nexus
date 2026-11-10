CREATE TYPE "ProjectDeliverableStatus" AS ENUM (
  'NOT_SUBMITTED',
  'IN_REVIEW',
  'REJECTED',
  'APPROVED',
  'SENT_TO_CLIENT'
);

ALTER TABLE "ProjectMilestone"
ADD COLUMN "description" VARCHAR(4000),
ADD COLUMN "expectedFileType" VARCHAR(50),
ADD COLUMN "deliveryStatus" "ProjectDeliverableStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN "rejectionReason" VARCHAR(2000),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "sentToClientById" TEXT,
ADD COLUMN "sentToClientAt" TIMESTAMP(3),
ADD COLUMN "workflowFileId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "ProjectMilestone_workflowFileId_key"
ON "ProjectMilestone"("workflowFileId");

ALTER TABLE "ProjectMilestone"
ADD CONSTRAINT "ProjectMilestone_workflowFileId_fkey"
FOREIGN KEY ("workflowFileId") REFERENCES "WorkflowFile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
