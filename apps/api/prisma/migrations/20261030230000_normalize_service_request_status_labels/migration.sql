DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'pending'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'PENDING'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'pending' TO 'PENDING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'in_progress'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'IN_PROGRESS'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'in_progress' TO 'IN_PROGRESS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'completed'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'COMPLETED'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'completed' TO 'COMPLETED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'cancelled'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME VALUE 'cancelled' TO 'CANCELLED';
  END IF;
END
$migration$;
