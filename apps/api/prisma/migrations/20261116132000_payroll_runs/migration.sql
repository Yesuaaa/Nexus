ALTER TYPE "WorkforceManagementSubject" ADD VALUE 'PAYROLL_PERIOD';
ALTER TYPE "WorkforceManagementSubject" ADD VALUE 'PAYROLL_RUN';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_PERIOD_CREATED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_RUN_CREATED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_CALCULATED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_RECALCULATED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_CALCULATION_FAILED';

CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED');
CREATE TYPE "PayrollCalculationStatus" AS ENUM ('COMPLETE', 'REVIEW_REQUIRED', 'BLOCKED');
CREATE TYPE "PayrollRunItemStatus" AS ENUM ('CALCULATED', 'REVIEW_REQUIRED', 'BLOCKED');
CREATE TYPE "PayrollRunItemComponentType" AS ENUM ('BASE_EARNING', 'ALLOWANCE', 'DEDUCTION');
CREATE TYPE "PayrollRunItemComponentStatus" AS ENUM ('CALCULATED', 'UNRESOLVED');

CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "cutoffLabel" VARCHAR(80) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_period_date_order" CHECK ("endDate" >= "startDate"),
    CONSTRAINT "payroll_period_label_not_empty" CHECK (length(trim("cutoffLabel")) > 0)
);

CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_calculation_count_nonnegative" CHECK ("calculationCount" >= 0)
);

CREATE TABLE "PayrollRunCalculation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "PayrollCalculationStatus" NOT NULL,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "grossTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductionsTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculatedItemCount" INTEGER NOT NULL DEFAULT 0,
    "reviewItemCount" INTEGER NOT NULL DEFAULT 0,
    "blockedItemCount" INTEGER NOT NULL DEFAULT 0,
    "inputSnapshot" JSONB NOT NULL,
    CONSTRAINT "PayrollRunCalculation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_calculation_revision_positive" CHECK ("revision" > 0),
    CONSTRAINT "payroll_run_calculation_totals_nonnegative" CHECK (
        "grossTotal" >= 0 AND "deductionsTotal" >= 0 AND "netTotal" >= 0
    ),
    CONSTRAINT "payroll_run_calculation_counts_nonnegative" CHECK (
        "calculatedItemCount" >= 0 AND "reviewItemCount" >= 0 AND "blockedItemCount" >= 0
    ),
    CONSTRAINT "payroll_run_calculation_currency_php" CHECK ("currency" = 'PHP')
);

CREATE TABLE "PayrollRunItem" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeNumberSnapshot" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "employmentTypeSnapshot" "EmploymentType" NOT NULL,
    "status" "PayrollRunItemStatus" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "grossAmount" DECIMAL(14,2),
    "deductionsAmount" DECIMAL(14,2),
    "netAmount" DECIMAL(14,2),
    "compensationSnapshot" JSONB NOT NULL,
    "attendanceSnapshot" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "blocks" JSONB NOT NULL,
    CONSTRAINT "PayrollRunItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_item_currency_php" CHECK ("currency" = 'PHP'),
    CONSTRAINT "payroll_run_item_amounts_nonnegative" CHECK (
        ("grossAmount" IS NULL OR "grossAmount" >= 0) AND
        ("deductionsAmount" IS NULL OR "deductionsAmount" >= 0) AND
        ("netAmount" IS NULL OR "netAmount" >= 0)
    ),
    CONSTRAINT "payroll_run_item_status_amounts" CHECK (
        ("status" = 'BLOCKED' AND "grossAmount" IS NULL AND "deductionsAmount" IS NULL AND "netAmount" IS NULL) OR
        ("status" = 'CALCULATED' AND "grossAmount" IS NOT NULL AND "deductionsAmount" IS NOT NULL AND "netAmount" IS NOT NULL) OR
        "status" = 'REVIEW_REQUIRED'
    )
);

CREATE TABLE "PayrollRunItemComponent" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "componentType" "PayrollRunItemComponentType" NOT NULL,
    "status" "PayrollRunItemComponentStatus" NOT NULL,
    "sourceId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(14,2),
    "metadata" JSONB NOT NULL,
    CONSTRAINT "PayrollRunItemComponent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_item_component_amount" CHECK (
        ("status" = 'CALCULATED' AND "amount" IS NOT NULL AND "amount" >= 0) OR
        ("status" = 'UNRESOLVED' AND "amount" IS NULL)
    ),
    CONSTRAINT "payroll_run_item_component_name_not_empty" CHECK (length(trim("name")) > 0)
);

CREATE UNIQUE INDEX "payroll_period_configuration_boundary_uq" ON "PayrollPeriod"("configurationId", "startDate", "endDate");
CREATE INDEX "payroll_period_date_range_idx" ON "PayrollPeriod"("startDate", "endDate");
CREATE INDEX "payroll_period_configuration_start_idx" ON "PayrollPeriod"("configurationId", "startDate");
CREATE UNIQUE INDEX "payroll_run_period_uq" ON "PayrollRun"("periodId");
CREATE INDEX "payroll_run_status_created_idx" ON "PayrollRun"("status", "createdAt");
CREATE UNIQUE INDEX "payroll_run_calculation_revision_uq" ON "PayrollRunCalculation"("runId", "revision");
CREATE INDEX "payroll_run_calculation_history_idx" ON "PayrollRunCalculation"("runId", "revision");
CREATE INDEX "payroll_run_calculation_status_idx" ON "PayrollRunCalculation"("status", "calculatedAt");
CREATE UNIQUE INDEX "payroll_run_item_calculation_employee_uq" ON "PayrollRunItem"("calculationId", "employeeId");
CREATE INDEX "payroll_run_item_status_idx" ON "PayrollRunItem"("calculationId", "status");
CREATE INDEX "payroll_run_item_employee_idx" ON "PayrollRunItem"("employeeId", "calculationId");
CREATE INDEX "payroll_run_item_component_type_idx" ON "PayrollRunItemComponent"("itemId", "componentType");
CREATE INDEX "payroll_run_item_component_source_idx" ON "PayrollRunItemComponent"("sourceId");

ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_configurationId_fkey"
    FOREIGN KEY ("configurationId") REFERENCES "PayrollConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRunCalculation" ADD CONSTRAINT "PayrollRunCalculation_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRunCalculation" ADD CONSTRAINT "PayrollRunCalculation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_calculationId_fkey"
    FOREIGN KEY ("calculationId") REFERENCES "PayrollRunCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRunItemComponent" ADD CONSTRAINT "PayrollRunItemComponent_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "PayrollRunItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
