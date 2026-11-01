CREATE TABLE "InternalConversation" (
  "id" TEXT NOT NULL,
  "participantKey" TEXT NOT NULL,
  "participantOneId" TEXT NOT NULL,
  "participantTwoId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalConversation_participantOneId_fkey"
    FOREIGN KEY ("participantOneId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternalConversation_participantTwoId_fkey"
    FOREIGN KEY ("participantTwoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InternalConversation_participantKey_key"
  ON "InternalConversation"("participantKey");
CREATE INDEX "InternalConversation_participantOneId_idx"
  ON "InternalConversation"("participantOneId");
CREATE INDEX "InternalConversation_participantTwoId_idx"
  ON "InternalConversation"("participantTwoId");
CREATE INDEX "InternalConversation_updatedAt_id_idx"
  ON "InternalConversation"("updatedAt", "id");

CREATE TABLE "InternalConversationParticipant" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "InternalConversationParticipant_pkey" PRIMARY KEY ("conversationId", "userId"),
  CONSTRAINT "InternalConversationParticipant_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "InternalConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternalConversationParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InternalConversationParticipant_userId_idx"
  ON "InternalConversationParticipant"("userId");

CREATE TABLE "InternalMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "clientMessageId" VARCHAR(36) NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "purgeAt" TIMESTAMP(3),
  CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "InternalConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternalMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InternalMessage_conversationId_senderId_clientMessageId_key"
  ON "InternalMessage"("conversationId", "senderId", "clientMessageId");
CREATE INDEX "InternalMessage_conversationId_createdAt_id_idx"
  ON "InternalMessage"("conversationId", "createdAt", "id");
CREATE INDEX "InternalMessage_conversationId_senderId_createdAt_idx"
  ON "InternalMessage"("conversationId", "senderId", "createdAt");
CREATE INDEX "InternalMessage_purgeAt_idx"
  ON "InternalMessage"("purgeAt");

ALTER TABLE "InternalConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InternalConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InternalMessage" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "InternalConversation" FROM anon;
    REVOKE ALL ON "InternalConversationParticipant" FROM anon;
    REVOKE ALL ON "InternalMessage" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "InternalConversation" FROM authenticated;
    REVOKE ALL ON "InternalConversationParticipant" FROM authenticated;
    REVOKE ALL ON "InternalMessage" FROM authenticated;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION notify_internal_conversation_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'internal-conversation:' || NEW."conversationId", true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER internal_conversation_inserted
AFTER INSERT ON "InternalMessage"
FOR EACH ROW EXECUTE FUNCTION notify_internal_conversation_message();

CREATE OR REPLACE FUNCTION notify_internal_conversation_updated_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING '{}'::jsonb, 'messages-changed', 'internal-conversation:' || OLD."conversationId", true;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER internal_conversation_deleted
AFTER DELETE ON "InternalMessage"
FOR EACH ROW EXECUTE FUNCTION notify_internal_conversation_updated_message();
