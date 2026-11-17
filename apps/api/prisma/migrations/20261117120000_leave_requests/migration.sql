CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID', 'OTHER');
CREATE TYPE "LeaveStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED');
CREATE TYPE "LeaveAction" AS ENUM ('SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED');

CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL,
  "requestKey" UUID NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "routeDepartmentId" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMPTZ(3),
  "type" "LeaveType" NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "LeaveStatus" NOT NULL DEFAULT 'SUBMITTED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leave_request_dates" CHECK (isfinite("startDate") AND isfinite("endDate") AND "endDate" >= "startDate"),
  CONSTRAINT "leave_request_reason" CHECK (length(trim("reason")) BETWEEN 5 AND 2000),
  CONSTRAINT "leave_request_version" CHECK ("version" > 0)
);

CREATE TABLE "LeaveRequestDay" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "timeZone" VARCHAR(100) NOT NULL,
  "policyName" VARCHAR(100) NOT NULL,
  "baseRequiredMinutes" INTEGER NOT NULL,
  "leaveMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveRequestDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leave_day_values" CHECK (isfinite("workDate") AND "baseRequiredMinutes" BETWEEN 0 AND 1440 AND "leaveMinutes" BETWEEN 0 AND "baseRequiredMinutes")
);

CREATE TABLE "LeaveDecision" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actionId" UUID NOT NULL,
  "action" "LeaveAction" NOT NULL,
  "fromStatus" "LeaveStatus",
  "toStatus" "LeaveStatus" NOT NULL,
  "note" VARCHAR(2000),
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leave_decision_note" CHECK ("note" IS NULL OR length(trim("note")) BETWEEN 5 AND 2000),
  CONSTRAINT "leave_decision_version" CHECK ("version" > 0)
);

ALTER TABLE "WorkflowNotification" ADD COLUMN "leaveRequestId" TEXT;
ALTER TABLE "WorkflowNotification" DROP CONSTRAINT "notification_source";
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "notification_source" CHECK (
  ("requestId" IS NOT NULL AND "eventId" IS NOT NULL AND "attendanceAdjustmentId" IS NULL AND "leaveRequestId" IS NULL)
  OR ("requestId" IS NULL AND "eventId" IS NULL AND "attendanceAdjustmentId" IS NOT NULL AND "leaveRequestId" IS NULL AND "type" IS NOT NULL AND "summary" IS NOT NULL)
  OR ("requestId" IS NULL AND "eventId" IS NULL AND "attendanceAdjustmentId" IS NULL AND "leaveRequestId" IS NOT NULL AND "type" IS NOT NULL AND "summary" IS NOT NULL)
);

CREATE UNIQUE INDEX "LeaveRequest_requestedById_requestKey_key" ON "LeaveRequest"("requestedById", "requestKey");
CREATE INDEX "LeaveRequest_employeeId_startDate_endDate_idx" ON "LeaveRequest"("employeeId", "startDate", "endDate");
CREATE INDEX "LeaveRequest_status_createdAt_id_idx" ON "LeaveRequest"("status", "createdAt", "id");
CREATE INDEX "LeaveRequest_routeDepartmentId_status_createdAt_idx" ON "LeaveRequest"("routeDepartmentId", "status", "createdAt");
CREATE UNIQUE INDEX "LeaveRequestDay_requestId_workDate_key" ON "LeaveRequestDay"("requestId", "workDate");
CREATE INDEX "LeaveRequestDay_employeeId_workDate_idx" ON "LeaveRequestDay"("employeeId", "workDate");
CREATE UNIQUE INDEX "LeaveDecision_requestId_actorId_actionId_key" ON "LeaveDecision"("requestId", "actorId", "actionId");
CREATE INDEX "LeaveDecision_requestId_createdAt_id_idx" ON "LeaveDecision"("requestId", "createdAt", "id");
CREATE UNIQUE INDEX "WorkflowNotification_userId_leaveRequestId_type_key" ON "WorkflowNotification"("userId", "leaveRequestId", "type");

ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD CONSTRAINT "LeaveRequestDay_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD CONSTRAINT "LeaveRequestDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD CONSTRAINT "LeaveRequestDay_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AttendancePolicyAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDecision" ADD CONSTRAINT "LeaveDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDecision" ADD CONSTRAINT "LeaveDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION leave_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Leave decision and approved-day history is immutable' USING ERRCODE = '23514';
END $$;

CREATE TRIGGER leave_decision_preserve BEFORE UPDATE OR DELETE ON "LeaveDecision"
  FOR EACH ROW EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER leave_day_preserve BEFORE UPDATE OR DELETE ON "LeaveRequestDay"
  FOR EACH ROW EXECUTE FUNCTION leave_history_immutable();
