-- CreateEnum
CREATE TYPE "AttendanceAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AttendancePolicy" ADD COLUMN     "overnightRequiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unpaidBreaksEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AttendanceAdjustment" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "originalSession" JSONB,
    "proposedStartedAt" TIMESTAMPTZ(3) NOT NULL,
    "proposedEndedAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNote" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AttendanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAdjustment_requestKey_key" ON "AttendanceAdjustment"("requestKey");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_employeeId_createdAt_id_idx" ON "AttendanceAdjustment"("employeeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_status_createdAt_id_idx" ON "AttendanceAdjustment"("status", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceWorkSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT attendance_adjustment_times CHECK (isfinite("proposedStartedAt") AND isfinite("proposedEndedAt") AND "proposedEndedAt" > "proposedStartedAt"), ADD CONSTRAINT attendance_adjustment_reason CHECK (length(trim(reason)) BETWEEN 5 AND 2000), ADD CONSTRAINT attendance_no_self_review CHECK ("reviewedById" IS NULL OR "reviewedById" <> "requestedById"), ADD CONSTRAINT attendance_review_state CHECK ((status = 'PENDING' AND "reviewedAt" IS NULL AND "reviewedById" IS NULL) OR (status <> 'PENDING' AND "reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL));
ALTER TABLE "AttendanceAudit" DROP CONSTRAINT attendance_audit_values;
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT attendance_audit_values CHECK (length(trim(reason)) > 0 AND length(trim(action)) > 0 AND length(trim("entityId")) > 0 AND "entityType" IN ('AttendancePolicy','AttendancePolicyDay','AttendancePolicyAssignment','AttendanceWorkday','AttendanceWorkSession','AttendanceBreak','AttendanceAdjustment'));
CREATE TRIGGER attendance_adjustment_audit AFTER INSERT OR UPDATE OR DELETE ON "AttendanceAdjustment" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();
