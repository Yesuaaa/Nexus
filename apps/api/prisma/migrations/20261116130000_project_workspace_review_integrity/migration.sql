ALTER TABLE "ProjectNoteRevision"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedById" TEXT,
  ADD COLUMN "supersededAt" TIMESTAMP(3),
  ADD COLUMN "supersededByRevisionId" TEXT,
  ADD COLUMN "unpublishedAt" TIMESTAMP(3),
  ADD COLUMN "unpublishedById" TEXT;

CREATE INDEX "ProjectNoteRevision_publishedById_idx"
  ON "ProjectNoteRevision"("publishedById");
CREATE INDEX "ProjectNoteRevision_supersededByRevisionId_idx"
  ON "ProjectNoteRevision"("supersededByRevisionId");
CREATE INDEX "ProjectNoteRevision_unpublishedById_idx"
  ON "ProjectNoteRevision"("unpublishedById");

ALTER TABLE "ProjectNoteRevision"
  ADD CONSTRAINT "ProjectNoteRevision_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectNoteRevision"
  ADD CONSTRAINT "ProjectNoteRevision_supersededByRevisionId_fkey"
  FOREIGN KEY ("supersededByRevisionId") REFERENCES "ProjectNoteRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectNoteRevision"
  ADD CONSTRAINT "ProjectNoteRevision_unpublishedById_fkey"
  FOREIGN KEY ("unpublishedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- BEGIN LEGACY REVIEW DATA REPAIR
DO $$
BEGIN
  -- A NOT_SUBMITTED milestone with an attached legacy file maps to WITHDRAWN.
  IF EXISTS (
    SELECT 1
    FROM "ProjectMilestone" AS milestone
    JOIN "ProjectDeliverableSubmission" AS submission
      ON submission."id" = 'legacy-' || milestone."id"
     AND submission."milestoneId" = milestone."id"
     AND submission."workflowFileId" = milestone."workflowFileId"
    WHERE milestone."deliveryStatus"::text = 'NOT_SUBMITTED'
      AND submission."status" <> 'WITHDRAWN'
  ) THEN
    RAISE EXCEPTION
      'Legacy NOT_SUBMITTED deliverables must be mapped to WITHDRAWN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ProjectMilestone" AS milestone
    JOIN "ProjectDeliverableSubmission" AS submission
      ON submission."id" = 'legacy-' || milestone."id"
     AND submission."milestoneId" = milestone."id"
     AND submission."workflowFileId" = milestone."workflowFileId"
    WHERE submission."status" = 'WITHDRAWN'
      AND milestone."deliveryStatus"::text <> 'NOT_SUBMITTED'
  ) THEN
    RAISE EXCEPTION
      'Legacy deliverable backfill mapped an unexpected status to WITHDRAWN; review the affected project data before continuing';
  END IF;
END $$;

UPDATE "ProjectDeliverableSubmission" AS submission
SET "feedback" = milestone."rejectionReason"
FROM "ProjectMilestone" AS milestone
WHERE submission."id" = 'legacy-' || milestone."id"
  AND submission."milestoneId" = milestone."id"
  AND submission."workflowFileId" = milestone."workflowFileId"
  AND submission."status" = 'REJECTED'
  AND milestone."deliveryStatus" = 'REJECTED'
  AND submission."feedback" IS NULL
  AND milestone."rejectionReason" IS NOT NULL;

UPDATE "ProjectDeliverableSubmission" AS submission
SET "note" = (
  SELECT CASE
    WHEN message."body" = 'Submitted for review.' THEN NULL
    ELSE message."body"
  END
  FROM "ProjectMessage" AS message
  WHERE message."projectId" = milestone."projectId"
    AND message."deliverable" ->> 'id' = milestone."id"
    AND message."deliverable" ->> 'fileId' = submission."workflowFileId"
    AND message."deliverable" ->> 'kind' = 'submission'
  ORDER BY message."createdAt" DESC, message."id" DESC
  LIMIT 1
)
FROM "ProjectMilestone" AS milestone
WHERE submission."id" = 'legacy-' || milestone."id"
  AND submission."milestoneId" = milestone."id"
  AND submission."workflowFileId" = milestone."workflowFileId"
  AND submission."note" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ProjectMessage" AS message
    WHERE message."projectId" = milestone."projectId"
      AND message."deliverable" ->> 'id' = milestone."id"
      AND message."deliverable" ->> 'fileId' = submission."workflowFileId"
      AND message."deliverable" ->> 'kind' = 'submission'
      AND message."body" <> 'Submitted for review.'
  );

UPDATE "ProjectNoteRevision"
SET
  "publishedAt" = "reviewedAt",
  "publishedById" = "reviewedById"
WHERE "status" = 'APPROVED'
  AND "clientVisible" = true
  AND "publishedAt" IS NULL;
-- END LEGACY REVIEW DATA REPAIR

