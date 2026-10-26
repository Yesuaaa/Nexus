-- CreateTable
CREATE TABLE "_ServiceDepartments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Preserve every existing service's responsible department.
INSERT INTO "_ServiceDepartments" ("A", "B")
SELECT "departmentId", "id" FROM "Service";

-- CreateIndex
CREATE UNIQUE INDEX "_ServiceDepartments_AB_unique" ON "_ServiceDepartments"("A", "B");

-- CreateIndex
CREATE INDEX "_ServiceDepartments_B_index" ON "_ServiceDepartments"("B");

-- AddForeignKey
ALTER TABLE "_ServiceDepartments" ADD CONSTRAINT "_ServiceDepartments_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceDepartments" ADD CONSTRAINT "_ServiceDepartments_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove the former single-department relationship after its data is copied.
ALTER TABLE "Service" DROP CONSTRAINT "Service_departmentId_fkey";
DROP INDEX "Service_departmentId_idx";
ALTER TABLE "Service" DROP COLUMN "departmentId";
