-- Acceptance identifies the department responsible for the conversation.
-- Historical requests remain unclaimed: a routed head explicitly starts their conversation.
ALTER TABLE "ServiceRequest"
  ADD COLUMN "acceptedDepartmentId" TEXT,
  ADD COLUMN "acceptedById" TEXT,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD CONSTRAINT "ServiceRequest_acceptedDepartmentId_fkey" FOREIGN KEY ("acceptedDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceRequest_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ServiceRequest_acceptedDepartmentId_createdAt_idx" ON "ServiceRequest"("acceptedDepartmentId", "createdAt");

CREATE TABLE "ServiceRequestMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "clientMessageId" VARCHAR(36) NOT NULL,
  "body" VARCHAR(4000) NOT NULL CHECK (length(btrim("body")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ServiceRequestMessage_requestId_senderId_clientMessageId_key" ON "ServiceRequestMessage"("requestId", "senderId", "clientMessageId");
CREATE INDEX "ServiceRequestMessage_requestId_createdAt_id_idx" ON "ServiceRequestMessage"("requestId", "createdAt", "id");

-- Browsers never query these rows through Supabase's Data API. Nexus validates
-- the active session and participants for every history/read/write request.
ALTER TABLE "ServiceRequestMessage" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "ServiceRequestMessage" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "ServiceRequestMessage" FROM authenticated;
  END IF;
END $$;

CREATE FUNCTION public.notify_request_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Ordinary PostgreSQL/PGlite can run the migrations without Supabase schemas.
  -- Broadcast only an invalidation, never message text or participant details.
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'request-conversation:' || NEW."requestId", true;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_conversation() FROM PUBLIC;
CREATE TRIGGER request_conversation_inserted AFTER INSERT ON "ServiceRequestMessage"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();

CREATE FUNCTION public.notify_request_conversation_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD."acceptedDepartmentId" IS NOT DISTINCT FROM NEW."acceptedDepartmentId"
     AND to_jsonb(OLD)->>'status' IS NOT DISTINCT FROM to_jsonb(NEW)->>'status' THEN
    RETURN NEW;
  END IF;
  EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
    USING '{}'::jsonb, 'messages-changed', 'request-conversation:' || NEW."id", true;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_conversation_acceptance() FROM PUBLIC;
CREATE TRIGGER request_conversation_accepted AFTER UPDATE ON "ServiceRequest"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation_acceptance();
