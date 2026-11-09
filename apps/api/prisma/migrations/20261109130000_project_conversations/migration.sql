CREATE TABLE "ProjectMessage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "clientMessageId" VARCHAR(36) NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectMessage_projectId_senderId_clientMessageId_key" ON "ProjectMessage"("projectId", "senderId", "clientMessageId");
CREATE INDEX "ProjectMessage_projectId_createdAt_id_idx" ON "ProjectMessage"("projectId", "createdAt", "id");

CREATE TABLE "ProjectConversationRead" (
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectConversationRead_pkey" PRIMARY KEY ("projectId", "userId"),
  CONSTRAINT "ProjectConversationRead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProjectConversationRead_userId_idx" ON "ProjectConversationRead"("userId");
ALTER TABLE "ProjectMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectConversationRead" ENABLE ROW LEVEL SECURITY;
