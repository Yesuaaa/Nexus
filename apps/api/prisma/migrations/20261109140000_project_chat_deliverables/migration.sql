ALTER TABLE "ProjectMessage"
  ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deliverable" JSONB;
