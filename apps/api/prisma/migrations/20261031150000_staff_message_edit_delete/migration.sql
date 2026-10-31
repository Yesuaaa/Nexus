ALTER TABLE "ServiceRequestMessage"
  ALTER COLUMN "body" DROP NOT NULL,
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "purgeAt" TIMESTAMP(3),
  ADD CONSTRAINT "ServiceRequestMessage_deletion_state_check" CHECK (
    ("body" IS NOT NULL AND "deletedAt" IS NULL AND "purgeAt" IS NULL)
    OR ("body" IS NULL AND "deletedAt" IS NOT NULL AND "purgeAt" IS NOT NULL)
  );

CREATE INDEX "ServiceRequestMessage_purgeAt_idx"
  ON "ServiceRequestMessage"("purgeAt");

CREATE TRIGGER request_conversation_message_updated
AFTER UPDATE OF "body", "editedAt", "deletedAt", "purgeAt"
ON "ServiceRequestMessage"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();

CREATE FUNCTION public.notify_request_conversation_deleted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'request-conversation:' || OLD."requestId", true;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_conversation_deleted() FROM PUBLIC;

CREATE TRIGGER request_conversation_message_deleted
AFTER DELETE ON "ServiceRequestMessage"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation_deleted();
