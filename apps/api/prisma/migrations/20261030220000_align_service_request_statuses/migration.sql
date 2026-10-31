-- Preserve existing requests when upgrading the original request lifecycle.
-- Databases already using the manager lifecycle need no enum renames.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ServiceRequestStatus' AND e.enumlabel = 'PENDING'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'PENDING' TO 'SUBMITTED';
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'IN_PROGRESS' TO 'UNDER_REVIEW';
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'COMPLETED' TO 'CLOSED';
  END IF;
END $$;

ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_CLIENT_INFO';
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_QUOTATION';
