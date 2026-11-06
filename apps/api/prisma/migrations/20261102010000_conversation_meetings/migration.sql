BEGIN;

CREATE TABLE "ConversationMeeting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "RequestConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clientActionId" VARCHAR(36) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "location" VARCHAR(1000) NOT NULL,
  "notes" VARCHAR(2000) NOT NULL,
  "status" "WorkflowConsultationStatus" NOT NULL DEFAULT 'SCHEDULED',
  "version" INTEGER NOT NULL DEFAULT 0,
  "proposedStartsAt" TIMESTAMP(3),
  "rescheduleNote" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConversationMeeting_conversationId_clientActionId_key" ON "ConversationMeeting"("conversationId", "clientActionId");
CREATE INDEX "ConversationMeeting_conversationId_createdAt_id_idx" ON "ConversationMeeting"("conversationId", "createdAt", "id");

CREATE TABLE "ConversationMeetingBooking" (
  "meetingId" TEXT NOT NULL REFERENCES "ConversationMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bookingId" TEXT NOT NULL REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("meetingId", "bookingId")
);
CREATE INDEX "ConversationMeetingBooking_bookingId_idx" ON "ConversationMeetingBooking"("bookingId");

ALTER TABLE "ConversationMeeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationMeetingBooking" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "ConversationMeeting", "ConversationMeetingBooking" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "ConversationMeeting", "ConversationMeetingBooking" FROM authenticated;
  END IF;
END $$;

CREATE TRIGGER conversation_meeting_changed
AFTER INSERT OR UPDATE OR DELETE ON "ConversationMeeting"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();

COMMIT;
