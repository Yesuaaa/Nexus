DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'PENDING'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'SUBMITTED'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'PENDING' TO 'SUBMITTED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'IN_PROGRESS'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'UNDER_REVIEW'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'IN_PROGRESS' TO 'UNDER_REVIEW';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'COMPLETED'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'CLOSED'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'COMPLETED' TO 'CLOSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'AWAITING_CLIENT_INFO'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" ADD VALUE 'AWAITING_CLIENT_INFO';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'READY_FOR_QUOTATION'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" ADD VALUE 'READY_FOR_QUOTATION';
  END IF;
END
$migration$;
