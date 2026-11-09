CREATE TYPE "ProjectChangeRequestKind" AS ENUM ('CHANGE', 'CANCELLATION');

ALTER TABLE "ProjectChangeRequest"
ADD COLUMN "kind" "ProjectChangeRequestKind" NOT NULL DEFAULT 'CHANGE';

CREATE INDEX "project_change_request_pending_lookup_idx"
ON "ProjectChangeRequest"("projectId", "kind", "status", "createdAt");
