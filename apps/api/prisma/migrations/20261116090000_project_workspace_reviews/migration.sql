CREATE TYPE "ProjectDeliverableSubmissionStatus" AS ENUM (
  'IN_REVIEW',
  'ESCALATED',
  'REJECTED',
  'APPROVED',
  'SENT_TO_CLIENT',
  'WITHDRAWN'
);

CREATE TYPE "ProjectNoteRevisionStatus" AS ENUM (
  'SUBMITTED',
  'ESCALATED',
  'APPROVED',
  'REVISION_REQUIRED',
  'REJECTED'
);

CREATE TABLE "ProjectDeliverableSubmission" (
  "id" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "workflowFileId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "note" VARCHAR(2000),
  "status" "ProjectDeliverableSubmissionStatus" NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "feedback" VARCHAR(2000),
  "escalatedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDeliverableSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectNote" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectNoteRevision" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "content" VARCHAR(4000) NOT NULL,
  "authorId" TEXT NOT NULL,
  "status" "ProjectNoteRevisionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "feedback" VARCHAR(2000),
  "escalatedAt" TIMESTAMP(3),
  "clientVisible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectNoteRevision_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProjectDeliverableSubmission" (
  "id",
  "milestoneId",
  "workflowFileId",
  "submittedById",
  "version",
  "status",
  "submittedAt",
  "reviewedById",
  "reviewedAt",
  "updatedAt"
)
SELECT
  'legacy-' || milestone."id",
  milestone."id",
  file."id",
  file."uploaderId",
  1,
  CASE milestone."deliveryStatus"
    WHEN 'IN_REVIEW' THEN 'IN_REVIEW'::"ProjectDeliverableSubmissionStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"ProjectDeliverableSubmissionStatus"
    WHEN 'APPROVED' THEN 'APPROVED'::"ProjectDeliverableSubmissionStatus"
    WHEN 'SENT_TO_CLIENT' THEN 'SENT_TO_CLIENT'::"ProjectDeliverableSubmissionStatus"
    ELSE 'WITHDRAWN'::"ProjectDeliverableSubmissionStatus"
  END,
  file."createdAt",
  milestone."reviewedById",
  milestone."reviewedAt",
  GREATEST(file."createdAt", COALESCE(milestone."reviewedAt", file."createdAt"))
FROM "ProjectMilestone" AS milestone
JOIN "WorkflowFile" AS file ON file."id" = milestone."workflowFileId";

CREATE UNIQUE INDEX "ProjectDeliverableSubmission_workflowFileId_key"
  ON "ProjectDeliverableSubmission"("workflowFileId");
CREATE UNIQUE INDEX "ProjectDeliverableSubmission_milestoneId_version_key"
  ON "ProjectDeliverableSubmission"("milestoneId", "version");
CREATE INDEX "ProjectDeliverableSubmission_milestoneId_submittedAt_id_idx"
  ON "ProjectDeliverableSubmission"("milestoneId", "submittedAt", "id");
CREATE INDEX "ProjectDeliverableSubmission_status_escalatedAt_idx"
  ON "ProjectDeliverableSubmission"("status", "escalatedAt");

CREATE INDEX "ProjectNote_projectId_updatedAt_id_idx"
  ON "ProjectNote"("projectId", "updatedAt", "id");
CREATE UNIQUE INDEX "ProjectNoteRevision_noteId_revision_key"
  ON "ProjectNoteRevision"("noteId", "revision");
CREATE INDEX "ProjectNoteRevision_noteId_createdAt_id_idx"
  ON "ProjectNoteRevision"("noteId", "createdAt", "id");
CREATE INDEX "ProjectNoteRevision_status_escalatedAt_idx"
  ON "ProjectNoteRevision"("status", "escalatedAt");
CREATE INDEX "ProjectNoteRevision_clientVisible_status_idx"
  ON "ProjectNoteRevision"("clientVisible", "status");

ALTER TABLE "ProjectDeliverableSubmission"
  ADD CONSTRAINT "ProjectDeliverableSubmission_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverableSubmission"
  ADD CONSTRAINT "ProjectDeliverableSubmission_workflowFileId_fkey"
  FOREIGN KEY ("workflowFileId") REFERENCES "WorkflowFile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverableSubmission"
  ADD CONSTRAINT "ProjectDeliverableSubmission_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverableSubmission"
  ADD CONSTRAINT "ProjectDeliverableSubmission_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectNote"
  ADD CONSTRAINT "ProjectNote_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNote"
  ADD CONSTRAINT "ProjectNote_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectNoteRevision"
  ADD CONSTRAINT "ProjectNoteRevision_noteId_fkey"
  FOREIGN KEY ("noteId") REFERENCES "ProjectNote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNoteRevision"
  ADD CONSTRAINT "ProjectNoteRevision_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectNoteRevision"
  ADD CONSTRAINT "ProjectNoteRevision_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
