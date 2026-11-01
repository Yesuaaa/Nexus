-- Deletion affects only the participant's inbox, preserving shared booking history.
CREATE TABLE "ServiceRequestConversationDeletion" (
  "requestId" TEXT NOT NULL REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceRequestConversationDeletion_pkey" PRIMARY KEY ("requestId", "userId")
);
CREATE INDEX "ServiceRequestConversationDeletion_userId_idx" ON "ServiceRequestConversationDeletion"("userId");

ALTER TABLE "ServiceRequestConversationDeletion" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "ServiceRequestConversationDeletion" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "ServiceRequestConversationDeletion" FROM authenticated;
  END IF;
END $$;
