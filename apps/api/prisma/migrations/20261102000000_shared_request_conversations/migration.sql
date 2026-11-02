-- One durable conversation is shared by every accepted booking for the same
-- client and department. Booking workflows remain on ServiceRequest.
CREATE TABLE "RequestConversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "departmentId" TEXT NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "clientReadAt" TIMESTAMP(3),
  "managerReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "RequestConversation_clientId_departmentId_key"
  ON "RequestConversation"("clientId", "departmentId");
CREATE INDEX "RequestConversation_departmentId_updatedAt_id_idx"
  ON "RequestConversation"("departmentId", "updatedAt", "id");
CREATE INDEX "RequestConversation_clientId_updatedAt_id_idx"
  ON "RequestConversation"("clientId", "updatedAt", "id");

-- Reuse one historical request ID as the stable conversation ID. This keeps
-- existing deep links valid while consolidating duplicate client/department chats.
INSERT INTO "RequestConversation" (
  "id", "clientId", "departmentId", "clientReadAt", "managerReadAt", "createdAt", "updatedAt"
)
SELECT
  MIN(request_row."id"),
  request_row."clientId",
  request_row."acceptedDepartmentId",
  MAX(request_row."clientReadAt"),
  MAX(request_row."staffReadAt"),
  MIN(COALESCE(request_row."acceptedAt", request_row."createdAt")),
  MAX(request_row."updatedAt")
FROM "ServiceRequest" AS request_row
WHERE request_row."acceptedDepartmentId" IS NOT NULL
  AND request_row."acceptedAt" IS NOT NULL
GROUP BY request_row."clientId", request_row."acceptedDepartmentId";

ALTER TABLE "ServiceRequest" ADD COLUMN "conversationId" TEXT;
UPDATE "ServiceRequest" AS request_row
SET "conversationId" = conversation."id"
FROM "RequestConversation" AS conversation
WHERE conversation."clientId" = request_row."clientId"
  AND conversation."departmentId" = request_row."acceptedDepartmentId"
  AND request_row."acceptedAt" IS NOT NULL;
ALTER TABLE "ServiceRequest"
  ADD CONSTRAINT "ServiceRequest_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "RequestConversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ServiceRequest_conversationId_createdAt_id_idx"
  ON "ServiceRequest"("conversationId", "createdAt", "id");

CREATE TABLE "RequestConversationDeletion" (
  "conversationId" TEXT NOT NULL REFERENCES "RequestConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestConversationDeletion_pkey" PRIMARY KEY ("conversationId", "userId")
);
CREATE INDEX "RequestConversationDeletion_userId_idx"
  ON "RequestConversationDeletion"("userId");

-- Carry forward a delete-for-me preference only when that participant deleted
-- every historical request which is now part of the shared conversation.
INSERT INTO "RequestConversationDeletion" ("conversationId", "userId", "deletedAt")
SELECT request_row."conversationId", deletion."userId", MAX(deletion."deletedAt")
FROM "ServiceRequestConversationDeletion" AS deletion
INNER JOIN "ServiceRequest" AS request_row ON request_row."id" = deletion."requestId"
WHERE request_row."conversationId" IS NOT NULL
GROUP BY request_row."conversationId", deletion."userId"
HAVING COUNT(DISTINCT deletion."requestId") = (
  SELECT COUNT(*)
  FROM "ServiceRequest" AS attached
  WHERE attached."conversationId" = request_row."conversationId"
);

DROP TABLE "ServiceRequestConversationDeletion";

DROP TRIGGER IF EXISTS request_conversation_inserted ON "ServiceRequestMessage";
DROP TRIGGER IF EXISTS request_conversation_message_updated ON "ServiceRequestMessage";
DROP TRIGGER IF EXISTS request_conversation_message_deleted ON "ServiceRequestMessage";
DROP TRIGGER IF EXISTS request_conversation_accepted ON "ServiceRequest";
DROP TRIGGER IF EXISTS request_workflow_event_inserted ON "WorkflowEvent";
DROP FUNCTION IF EXISTS public.notify_request_conversation();
DROP FUNCTION IF EXISTS public.notify_request_conversation_deleted();
DROP FUNCTION IF EXISTS public.notify_request_conversation_acceptance();

ALTER TABLE "ServiceRequestMessage" ADD COLUMN "conversationId" TEXT;
UPDATE "ServiceRequestMessage" AS message
SET "conversationId" = request_row."conversationId"
FROM "ServiceRequest" AS request_row
WHERE request_row."id" = message."requestId";
ALTER TABLE "ServiceRequestMessage" ALTER COLUMN "conversationId" SET NOT NULL;
ALTER TABLE "ServiceRequestMessage"
  DROP CONSTRAINT "ServiceRequestMessage_requestId_fkey",
  ADD CONSTRAINT "ServiceRequestMessage_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceRequestMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "RequestConversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequestMessage" ALTER COLUMN "requestId" DROP NOT NULL;

DROP INDEX "ServiceRequestMessage_requestId_senderId_clientMessageId_key";
DROP INDEX "ServiceRequestMessage_requestId_createdAt_id_idx";
DROP INDEX "ServiceRequestMessage_requestId_senderId_createdAt_idx";
CREATE UNIQUE INDEX "ServiceRequestMessage_conversationId_senderId_clientMessageId_key"
  ON "ServiceRequestMessage"("conversationId", "senderId", "clientMessageId");
CREATE INDEX "ServiceRequestMessage_conversationId_createdAt_id_idx"
  ON "ServiceRequestMessage"("conversationId", "createdAt", "id");
CREATE INDEX "ServiceRequestMessage_conversationId_senderId_createdAt_idx"
  ON "ServiceRequestMessage"("conversationId", "senderId", "createdAt");
CREATE INDEX "ServiceRequestMessage_requestId_createdAt_id_idx"
  ON "ServiceRequestMessage"("requestId", "createdAt", "id");

ALTER TABLE "RequestConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestConversationDeletion" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "RequestConversation" FROM anon;
    REVOKE ALL ON "RequestConversationDeletion" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "RequestConversation" FROM authenticated;
    REVOKE ALL ON "RequestConversationDeletion" FROM authenticated;
  END IF;
END $$;

CREATE FUNCTION public.notify_request_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE topic_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    topic_id := OLD."conversationId";
  ELSE
    topic_id := NEW."conversationId";
  END IF;
  IF topic_id IS NOT NULL
     AND to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'request-conversation:' || topic_id, true;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_conversation() FROM PUBLIC;

CREATE TRIGGER request_conversation_inserted
AFTER INSERT ON "ServiceRequestMessage"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();
CREATE TRIGGER request_conversation_message_updated
AFTER UPDATE OF "body", "editedAt", "deletedAt", "purgeAt" ON "ServiceRequestMessage"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();
CREATE TRIGGER request_conversation_message_deleted
AFTER DELETE ON "ServiceRequestMessage"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();

CREATE FUNCTION public.notify_request_workflow_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE topic_id TEXT;
BEGIN
  SELECT request_row."conversationId" INTO topic_id
  FROM public."ServiceRequest" AS request_row
  WHERE request_row."id" = NEW."requestId";
  IF topic_id IS NOT NULL
     AND to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'request-conversation:' || topic_id, true;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_workflow_event() FROM PUBLIC;
CREATE TRIGGER request_workflow_event_inserted
AFTER INSERT ON "WorkflowEvent"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_workflow_event();

CREATE FUNCTION public.notify_request_conversation_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW."conversationId" IS NOT NULL
     AND (OLD."conversationId" IS DISTINCT FROM NEW."conversationId"
       OR OLD."status" IS DISTINCT FROM NEW."status")
     AND to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'request-conversation:' || NEW."conversationId", true;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_conversation_booking() FROM PUBLIC;
CREATE TRIGGER request_conversation_booking_updated
AFTER UPDATE ON "ServiceRequest"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation_booking();
