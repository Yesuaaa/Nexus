-- CreateEnum
CREATE TYPE "CommitmentKind" AS ENUM ('APPOINTMENT', 'LEAVE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "WorkPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkAssignmentStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "WorkingSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "WorkingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCommitment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "CommitmentKind" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "ownerDepartmentId" TEXT NOT NULL,
    "serviceRequestId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "staffingRequestId" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "estimatedHours" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3),
    "priority" "WorkPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "WorkAssignmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffingRequest" (
    "id" TEXT NOT NULL,
    "ownerDepartmentId" TEXT NOT NULL,
    "recipientDepartmentId" TEXT NOT NULL,
    "serviceRequestId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "estimatedHours" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3),
    "priority" "WorkPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "StaffingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectDepartments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectDepartments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkingSchedule_employeeId_weekday_startMinute_key" ON "WorkingSchedule"("employeeId", "weekday", "startMinute");

-- CreateIndex
CREATE INDEX "WorkCommitment_employeeId_startsAt_endsAt_idx" ON "WorkCommitment"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkAssignment_staffingRequestId_key" ON "WorkAssignment"("staffingRequestId");

-- CreateIndex
CREATE INDEX "WorkAssignment_employeeId_startsAt_endsAt_idx" ON "WorkAssignment"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WorkAssignment_ownerDepartmentId_idx" ON "WorkAssignment"("ownerDepartmentId");

-- CreateIndex
CREATE INDEX "StaffingRequest_ownerDepartmentId_status_idx" ON "StaffingRequest"("ownerDepartmentId", "status");

-- CreateIndex
CREATE INDEX "StaffingRequest_recipientDepartmentId_status_idx" ON "StaffingRequest"("recipientDepartmentId", "status");

-- CreateIndex
CREATE INDEX "_ProjectDepartments_B_index" ON "_ProjectDepartments"("B");

-- AddForeignKey
ALTER TABLE "WorkingSchedule" ADD CONSTRAINT "WorkingSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCommitment" ADD CONSTRAINT "WorkCommitment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_ownerDepartmentId_fkey" FOREIGN KEY ("ownerDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_staffingRequestId_fkey" FOREIGN KEY ("staffingRequestId") REFERENCES "StaffingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_ownerDepartmentId_fkey" FOREIGN KEY ("ownerDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_recipientDepartmentId_fkey" FOREIGN KEY ("recipientDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectDepartments" ADD CONSTRAINT "_ProjectDepartments_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectDepartments" ADD CONSTRAINT "_ProjectDepartments_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep capacity and target invariants intact for imports as well as API writes.
ALTER TABLE "WorkingSchedule" ADD CONSTRAINT "WorkingSchedule_valid_shift"
CHECK ("weekday" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");
ALTER TABLE "WorkCommitment" ADD CONSTRAINT "WorkCommitment_valid_period" CHECK ("startsAt" < "endsAt");
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_valid_block"
CHECK ("startsAt" < "endsAt" AND "estimatedHours" > 0 AND "estimatedHours" <= EXTRACT(EPOCH FROM ("endsAt" - "startsAt"))/3600 AND ("deadline" IS NULL OR "deadline" >= "endsAt"));
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_one_target" CHECK (num_nonnulls("serviceRequestId", "projectId", "taskId") = 1);
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_valid_block"
CHECK ("startsAt" < "endsAt" AND "estimatedHours" > 0 AND "estimatedHours" <= EXTRACT(EPOCH FROM ("endsAt" - "startsAt"))/3600 AND ("deadline" IS NULL OR "deadline" >= "endsAt"));
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_one_target" CHECK (num_nonnulls("serviceRequestId", "projectId", "taskId") = 1);
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_different_departments" CHECK ("ownerDepartmentId" <> "recipientDepartmentId");
