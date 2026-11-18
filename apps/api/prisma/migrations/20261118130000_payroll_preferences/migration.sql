ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_PREFERENCES_UPDATED';

CREATE TABLE "PayrollPreferences" (
  "id" TEXT PRIMARY KEY CHECK ("id" = 'payroll-preferences'),
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "showCompanyLogo" BOOLEAN NOT NULL,
  "showEmployeeId" BOOLEAN NOT NULL,
  "requirePublicationConfirmation" BOOLEAN NOT NULL,
  "requireSimulationConfirmation" BOOLEAN NOT NULL
);
