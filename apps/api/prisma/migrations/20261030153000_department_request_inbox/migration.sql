-- Normalized databases already have this label; original databases do not.
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
