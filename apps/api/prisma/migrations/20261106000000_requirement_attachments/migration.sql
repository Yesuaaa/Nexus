CREATE TABLE "_RequirementAttachments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RequirementAttachments_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_RequirementAttachments_B_index" ON "_RequirementAttachments"("B");

ALTER TABLE "_RequirementAttachments" ADD CONSTRAINT "_RequirementAttachments_A_fkey"
    FOREIGN KEY ("A") REFERENCES "WorkflowFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RequirementAttachments" ADD CONSTRAINT "_RequirementAttachments_B_fkey"
    FOREIGN KEY ("B") REFERENCES "WorkflowRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "_RequirementAttachments" ("A", "B")
SELECT "fileId", "id" FROM "WorkflowRequirement" WHERE "fileId" IS NOT NULL;

ALTER TABLE "_RequirementAttachments" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON "_RequirementAttachments" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON "_RequirementAttachments" FROM authenticated;
    END IF;
END $$;
