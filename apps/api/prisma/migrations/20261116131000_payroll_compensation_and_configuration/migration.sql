CREATE TYPE "PayrollPayType" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY');
CREATE TYPE "CompensationComponentType" AS ENUM ('ALLOWANCE', 'RECURRING_DEDUCTION');
CREATE TYPE "CompensationCalculationType" AS ENUM ('FIXED');
CREATE TYPE "PayrollFrequency" AS ENUM ('MONTHLY', 'SEMI_MONTHLY');

CREATE TABLE "EmployeeCompensation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payType" "PayrollPayType" NOT NULL,
    "baseRate" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" TEXT NOT NULL,
    "changeReason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "EmployeeCompensation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_compensation_rate_nonnegative" CHECK ("baseRate" >= 0),
    CONSTRAINT "employee_compensation_currency_php" CHECK ("currency" = 'PHP'),
    CONSTRAINT "employee_compensation_effective_order" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

CREATE TABLE "CompensationComponent" (
    "id" TEXT NOT NULL,
    "compensationId" TEXT NOT NULL,
    "type" "CompensationComponentType" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "calculationType" "CompensationCalculationType" NOT NULL DEFAULT 'FIXED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompensationComponent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compensation_component_amount_nonnegative" CHECK ("amount" >= 0)
);

CREATE TABLE "PayrollConfiguration" (
    "id" TEXT NOT NULL,
    "frequency" "PayrollFrequency" NOT NULL,
    "firstCutoffDay" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" TEXT NOT NULL,
    "changeReason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "PayrollConfiguration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_configuration_currency_php" CHECK ("currency" = 'PHP'),
    CONSTRAINT "payroll_configuration_cutoff_valid" CHECK (
        ("frequency" = 'MONTHLY' AND "firstCutoffDay" IS NULL) OR
        ("frequency" = 'SEMI_MONTHLY' AND "firstCutoffDay" BETWEEN 1 AND 27)
    ),
    CONSTRAINT "payroll_configuration_effective_order" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

CREATE UNIQUE INDEX "employee_compensation_employee_start_uq" ON "EmployeeCompensation"("employeeId", "effectiveFrom");
CREATE INDEX "employee_compensation_timeline_idx" ON "EmployeeCompensation"("employeeId", "effectiveFrom");
CREATE INDEX "employee_compensation_effective_idx" ON "EmployeeCompensation"("effectiveFrom", "effectiveTo");
CREATE INDEX "compensation_component_type_idx" ON "CompensationComponent"("compensationId", "type");
CREATE UNIQUE INDEX "payroll_configuration_start_uq" ON "PayrollConfiguration"("effectiveFrom");
CREATE INDEX "payroll_configuration_effective_idx" ON "PayrollConfiguration"("effectiveFrom", "effectiveTo");

ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompensationComponent" ADD CONSTRAINT "CompensationComponent_compensationId_fkey"
    FOREIGN KEY ("compensationId") REFERENCES "EmployeeCompensation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollConfiguration" ADD CONSTRAINT "PayrollConfiguration_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
