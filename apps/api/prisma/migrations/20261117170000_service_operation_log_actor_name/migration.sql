-- Keep a bounded display-name snapshot so attribution remains understandable
-- if an account is renamed or later removed. Existing rows remain nullable and
-- are resolved from the current account only when read.
ALTER TABLE "ServiceOperationLog"
ADD COLUMN "actorName" VARCHAR(100);
