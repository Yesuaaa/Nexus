CREATE TABLE "ServiceOperationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" VARCHAR(60),
  "endpoint" VARCHAR(160),
  "event" VARCHAR(60) NOT NULL,
  "source" VARCHAR(40) NOT NULL,
  "outcome" VARCHAR(20) NOT NULL,
  "actorId" VARCHAR(80),
  "actorRole" "Role",
  "subjectId" VARCHAR(80),
  "requestId" VARCHAR(80),
  "correlationId" UUID NOT NULL,
  "status" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ServiceOperationLog_createdAt_id_idx" ON "ServiceOperationLog"("createdAt", "id");
CREATE INDEX "ServiceOperationLog_outcome_createdAt_id_idx" ON "ServiceOperationLog"("outcome", "createdAt", "id");
CREATE INDEX "ServiceOperationLog_requestId_createdAt_id_idx" ON "ServiceOperationLog"("requestId", "createdAt", "id");
CREATE INDEX "ServiceOperationLog_actorId_createdAt_id_idx" ON "ServiceOperationLog"("actorId", "createdAt", "id");
CREATE INDEX "ServiceOperationLog_correlationId_idx" ON "ServiceOperationLog"("correlationId");
