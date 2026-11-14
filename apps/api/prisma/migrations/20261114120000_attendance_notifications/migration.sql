ALTER TABLE "WorkflowNotification" ALTER COLUMN "requestId" DROP NOT NULL, ALTER COLUMN "eventId" DROP NOT NULL;
ALTER TABLE "WorkflowNotification" ADD COLUMN "attendanceAdjustmentId" TEXT, ADD COLUMN "type" TEXT, ADD COLUMN "summary" TEXT;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_attendanceAdjustmentId_fkey" FOREIGN KEY ("attendanceAdjustmentId") REFERENCES "AttendanceAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "WorkflowNotification_userId_attendanceAdjustmentId_type_key" ON "WorkflowNotification"("userId", "attendanceAdjustmentId", "type");
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "notification_source" CHECK (("requestId" IS NOT NULL AND "eventId" IS NOT NULL AND "attendanceAdjustmentId" IS NULL) OR ("requestId" IS NULL AND "eventId" IS NULL AND "attendanceAdjustmentId" IS NOT NULL AND "type" IS NOT NULL AND "summary" IS NOT NULL));
