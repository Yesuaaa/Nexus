ALTER TABLE "ServiceRequest"
  ADD COLUMN "staffReadAt" TIMESTAMP(3);

UPDATE "ServiceRequest" AS service_request
SET "staffReadAt" = latest_message."latestMessageAt"
FROM (
  SELECT message."requestId", MAX(message."createdAt") AS "latestMessageAt"
  FROM "ServiceRequestMessage" AS message
  INNER JOIN "ServiceRequest" AS accepted_request
    ON accepted_request."id" = message."requestId"
    AND accepted_request."acceptedAt" IS NOT NULL
    AND accepted_request."acceptedDepartmentId" IS NOT NULL
  GROUP BY message."requestId"
) AS latest_message
WHERE service_request."id" = latest_message."requestId";
