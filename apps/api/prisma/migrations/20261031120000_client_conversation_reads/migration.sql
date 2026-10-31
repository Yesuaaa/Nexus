ALTER TABLE "ServiceRequest"
  ADD COLUMN "clientReadAt" TIMESTAMP(3);

UPDATE "ServiceRequest" AS service_request
SET "clientReadAt" = latest_message."latestMessageAt"
FROM (
  SELECT "requestId", MAX("createdAt") AS "latestMessageAt"
  FROM "ServiceRequestMessage"
  GROUP BY "requestId"
) AS latest_message
WHERE service_request."id" = latest_message."requestId";

CREATE INDEX "ServiceRequestMessage_requestId_senderId_createdAt_idx"
  ON "ServiceRequestMessage"("requestId", "senderId", "createdAt");
