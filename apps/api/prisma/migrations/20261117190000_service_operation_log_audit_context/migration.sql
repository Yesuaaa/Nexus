-- Add bounded affected-record identity and structured, allowlisted changes.
-- Writers validate the JSON shape and never persist arbitrary request bodies.
ALTER TABLE "ServiceOperationLog"
ADD COLUMN "targetType" VARCHAR(60),
ADD COLUMN "targetLabel" VARCHAR(160),
ADD COLUMN "changes" JSONB;
