CREATE TABLE "ProjectManagementLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event" VARCHAR(60) NOT NULL,
  "source" VARCHAR(40) NOT NULL,
  "outcome" VARCHAR(20) NOT NULL,
  "actorId" VARCHAR(80),
  "actorName" VARCHAR(100),
  "actorRole" "Role",
  "projectId" VARCHAR(80),
  "projectName" VARCHAR(160),
  "workspaceId" VARCHAR(80),
  "targetId" VARCHAR(80),
  "targetLabel" VARCHAR(160),
  "requestId" VARCHAR(80),
  "changes" JSONB,
  "endpoint" VARCHAR(160),
  "correlationId" UUID NOT NULL,
  "status" INTEGER,
  "failureCode" VARCHAR(60),
  "failureReason" VARCHAR(240),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectManagementLog_outcome_check" CHECK (
    ("outcome" = 'SUCCESS' AND "projectId" IS NOT NULL AND "status" IS NULL AND "event" <> 'API_FAILURE')
    OR ("outcome" = 'FAILURE' AND "status" IS NOT NULL AND "status" BETWEEN 500 AND 599 AND "event" = 'API_FAILURE')
  )
);
CREATE INDEX "ProjectManagementLog_createdAt_id_idx" ON "ProjectManagementLog"("createdAt", "id");
CREATE INDEX "ProjectManagementLog_outcome_createdAt_id_idx" ON "ProjectManagementLog"("outcome", "createdAt", "id");
CREATE INDEX "ProjectManagementLog_actorId_createdAt_id_idx" ON "ProjectManagementLog"("actorId", "createdAt", "id");
CREATE INDEX "ProjectManagementLog_projectId_createdAt_id_idx" ON "ProjectManagementLog"("projectId", "createdAt", "id");
CREATE INDEX "ProjectManagementLog_workspaceId_createdAt_id_idx" ON "ProjectManagementLog"("workspaceId", "createdAt", "id");
CREATE INDEX "ProjectManagementLog_correlationId_idx" ON "ProjectManagementLog"("correlationId");
