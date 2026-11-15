-- CreateEnum
CREATE TYPE "AccountManagementAction" AS ENUM ('CREATED', 'PROFILE_UPDATED', 'ROLE_CHANGED', 'STATUS_CHANGED', 'PASSWORD_RESET', 'ARCHIVED', 'RESTORED', 'DELETED');

-- CreateEnum
CREATE TYPE "AccountManagementOrigin" AS ENUM ('ACCOUNT_MANAGEMENT', 'CLIENT_MANAGEMENT', 'EMPLOYEE_MANAGEMENT');

-- CreateEnum
CREATE TYPE "WorkforceManagementSubject" AS ENUM ('EMPLOYEE', 'DEPARTMENT', 'TEAM');

-- CreateEnum
CREATE TYPE "WorkforceManagementAction" AS ENUM ('CREATED', 'PROFILE_UPDATED', 'STATUS_CHANGED', 'ASSIGNMENT_CHANGED', 'HEAD_CHANGED', 'TEMPORARY_HEAD_CHANGED', 'LEAD_CHANGED', 'TITLE_CLEARED', 'DELETED');

-- CreateEnum
CREATE TYPE "WorkforceManagementOrigin" AS ENUM ('ACCOUNT_MANAGEMENT', 'EMPLOYEE_MANAGEMENT', 'DEPARTMENT_MANAGEMENT', 'TEAM_MANAGEMENT');

-- CreateTable
CREATE TABLE "AccountManagementChange" (
    "id" TEXT NOT NULL,
    "actorAccountId" VARCHAR(80) NOT NULL,
    "actorRoleAtTime" "Role" NOT NULL,
    "operationId" UUID NOT NULL,
    "subjectAccountId" VARCHAR(80) NOT NULL,
    "action" "AccountManagementAction" NOT NULL,
    "origin" "AccountManagementOrigin" NOT NULL,
    "changedFields" TEXT[],
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountManagementChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceManagementChange" (
    "id" TEXT NOT NULL,
    "actorAccountId" VARCHAR(80) NOT NULL,
    "actorRoleAtTime" "Role" NOT NULL,
    "operationId" UUID NOT NULL,
    "subjectType" "WorkforceManagementSubject" NOT NULL,
    "subjectId" VARCHAR(80) NOT NULL,
    "action" "WorkforceManagementAction" NOT NULL,
    "origin" "WorkforceManagementOrigin" NOT NULL,
    "changedFields" TEXT[],
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceManagementChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_change_subject_time_idx" ON "AccountManagementChange"("subjectAccountId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "account_change_actor_time_idx" ON "AccountManagementChange"("actorAccountId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "account_change_operation_idx" ON "AccountManagementChange"("operationId");

-- CreateIndex
CREATE INDEX "workforce_change_subject_time_idx" ON "WorkforceManagementChange"("subjectType", "subjectId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "workforce_change_actor_time_idx" ON "WorkforceManagementChange"("actorAccountId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "workforce_change_operation_idx" ON "WorkforceManagementChange"("operationId");
