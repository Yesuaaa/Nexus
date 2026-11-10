CREATE TYPE "ProjectWorkspaceStructure" AS ENUM ('SEPARATE', 'MULTI_WORKSTREAM');

ALTER TABLE "Project"
ADD COLUMN "templateKey" VARCHAR(60),
ADD COLUMN "workPlan" JSONB,
ADD COLUMN "workspaceGroupId" TEXT;

CREATE TABLE "ProjectWorkspaceGroup" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "structure" "ProjectWorkspaceStructure" NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectWorkspaceGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_workspaceGroupId_idx" ON "Project"("workspaceGroupId");
CREATE INDEX "ProjectWorkspaceGroup_clientId_createdAt_id_idx" ON "ProjectWorkspaceGroup"("clientId", "createdAt", "id");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_workspaceGroupId_fkey"
FOREIGN KEY ("workspaceGroupId") REFERENCES "ProjectWorkspaceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkspaceGroup"
ADD CONSTRAINT "ProjectWorkspaceGroup_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkspaceGroup"
ADD CONSTRAINT "ProjectWorkspaceGroup_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
