-- Preserve project lifecycle statuses already used by existing databases.
-- IF NOT EXISTS also supports databases where these labels were added earlier.
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'ACTIVATED';
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'CONCLUDED';
