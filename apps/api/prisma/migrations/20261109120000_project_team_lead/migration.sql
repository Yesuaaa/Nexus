ALTER TABLE "ProjectStaff" ADD COLUMN "isTeamLead" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "ProjectStaff_one_team_lead_per_project"
ON "ProjectStaff" ("projectId") WHERE "isTeamLead";
