-- Store only closed diagnostic codes and sanitized causal summaries.
-- Raw exceptions and stack traces remain in server output under correlationId.
ALTER TABLE "ServiceOperationLog"
ADD COLUMN "failureCode" VARCHAR(60),
ADD COLUMN "failureReason" VARCHAR(240);
