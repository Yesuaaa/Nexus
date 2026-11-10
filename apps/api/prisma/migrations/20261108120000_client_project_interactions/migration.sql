CREATE TYPE "ProjectClientReviewStatus" AS ENUM ('APPROVED', 'REVISION_REQUESTED');
CREATE TYPE "ProjectChangeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'NOT_APPROVED');

CREATE TABLE "ProjectDeliverableClientReview" (
  "id" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "workflowFileId" TEXT,
  "clientId" TEXT NOT NULL,
  "status" "ProjectClientReviewStatus" NOT NULL,
  "note" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDeliverableClientReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectChangeRequest" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "details" VARCHAR(4000) NOT NULL,
  "status" "ProjectChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "responseNote" VARCHAR(2000),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectDeliverableClientReview_milestoneId_createdAt_idx"
ON "ProjectDeliverableClientReview"("milestoneId", "createdAt");
CREATE INDEX "ProjectDeliverableClientReview_workflowFileId_idx"
ON "ProjectDeliverableClientReview"("workflowFileId");
CREATE UNIQUE INDEX "ProjectDeliverableClientReview_workflowFileId_clientId_key"
ON "ProjectDeliverableClientReview"("workflowFileId", "clientId");
CREATE INDEX "ProjectChangeRequest_projectId_status_createdAt_idx"
ON "ProjectChangeRequest"("projectId", "status", "createdAt");

ALTER TABLE "ProjectDeliverableClientReview"
ADD CONSTRAINT "ProjectDeliverableClientReview_milestoneId_fkey"
FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectDeliverableClientReview_workflowFileId_fkey"
FOREIGN KEY ("workflowFileId") REFERENCES "WorkflowFile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectDeliverableClientReview_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectChangeRequest"
ADD CONSTRAINT "ProjectChangeRequest_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectChangeRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectChangeRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
