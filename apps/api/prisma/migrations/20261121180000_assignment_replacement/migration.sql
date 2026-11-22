-- Preserve the period that assigning a replacement actually shortened.
ALTER TABLE "AttendancePolicyAssignment"
  ADD COLUMN "replacedAssignmentId" TEXT,
  ADD COLUMN "replacedUntil" DATE;

-- Backfill only pairs proven to come from the same assignment operation.
-- Older audit rows used one transaction per operation before operationId existed.
UPDATE "AttendancePolicyAssignment" replacement
SET "replacedAssignmentId" = change."entityId",
    "replacedUntil" = (change.before->>'effectiveUntil')::date
FROM "AttendanceAudit" creation JOIN "AttendanceAudit" change
  ON change."employeeId" = creation."employeeId"
 AND change."entityType" = 'AttendancePolicyAssignment' AND change.action = 'UPDATE'
 AND change.reason = 'Assigned attendance policy version'
 AND (change."operationId" = creation."operationId" OR
     (change."operationId" IS NULL AND creation."operationId" IS NULL
      AND change.xmin = creation.xmin AND change.xmin <> '2'::xid
      AND change."createdAt" = creation."createdAt"))
 AND change.after->>'effectiveUntil' = creation.after->>'effectiveFrom'
 AND change.before->>'effectiveUntil' IS DISTINCT FROM change.after->>'effectiveUntil'
WHERE creation."entityType" = 'AttendancePolicyAssignment' AND creation.action = 'INSERT'
  AND creation.reason = 'Assigned attendance policy version'
  AND creation."entityId" = replacement.id AND replacement."cancelledAt" IS NULL;
