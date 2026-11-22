BEGIN;

ALTER TABLE "WorkflowNotification" ADD COLUMN "leaveVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "WorkflowNotification_leave_version_key"
    ON "WorkflowNotification"("userId", "leaveRequestId", "type", "leaveVersion");

DROP INDEX "WorkflowNotification_userId_leaveRequestId_type_key";

COMMIT;
