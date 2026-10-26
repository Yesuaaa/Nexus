CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "contactNumber" TEXT,
    "position" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "departmentId" TEXT,
    "teamId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

UPDATE "User" AS u
SET "teamId" = NULL
FROM "Team" AS team
WHERE u."teamId" = team."id"
  AND u."departmentId" IS NOT NULL
  AND u."departmentId" <> team."departmentId";

UPDATE "User" AS u
SET "departmentId" = team."departmentId"
FROM "Team" AS team
WHERE u."teamId" = team."id"
  AND u."departmentId" IS NULL;

WITH eligible AS (
    SELECT
        u."id",
        u."email",
        u."fullName",
        u."contactNumber",
        u."position",
        u."departmentId",
        u."teamId",
        team."departmentId" AS "teamDepartmentId",
        ROW_NUMBER() OVER (ORDER BY u."createdAt" ASC, u."id" ASC) AS rn
    FROM "User" AS u
    LEFT JOIN "Team" AS team ON team."id" = u."teamId"
    WHERE u."role" IN ('ADMIN', 'STAFF')
       OR u."departmentId" IS NOT NULL
       OR u."teamId" IS NOT NULL
)
INSERT INTO "Employee" (
    "id", "employeeId", "fullName", "email", "contactNumber", "position",
    "departmentId", "teamId", "userId", "createdAt", "updatedAt"
)
SELECT
    'employee_' || eligible.rn::TEXT,
    'EMP-' || LPAD(eligible.rn::TEXT, 6, '0'),
    COALESCE(NULLIF(BTRIM(eligible."fullName"), ''), eligible."email"),
    eligible."email",
    eligible."contactNumber",
    eligible."position",
    COALESCE(eligible."departmentId", eligible."teamDepartmentId"),
    CASE
        WHEN eligible."teamId" IS NOT NULL
         AND eligible."departmentId" IS NOT NULL
         AND eligible."departmentId" <> eligible."teamDepartmentId"
        THEN NULL
        ELSE eligible."teamId"
    END,
    eligible."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM eligible;

CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");
CREATE INDEX "Employee_employmentType_idx" ON "Employee"("employmentType");
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
