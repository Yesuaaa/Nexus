-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('google', 'facebook', 'apple');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "reauthenticatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SocialIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAttempt" (
    "id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "purpose" TEXT NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCompletion" (
    "id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL,
    "fullName" TEXT,
    "verifierHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "emailCodeHash" TEXT,
    "emailCodeExpiresAt" TIMESTAMP(3),
    "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "SocialCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialIdentity_provider_subject_key" ON "SocialIdentity"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "SocialIdentity_userId_provider_key" ON "SocialIdentity"("userId", "provider");

-- CreateIndex
CREATE INDEX "OAuthAttempt_expiresAt_idx" ON "OAuthAttempt"("expiresAt");

-- CreateIndex
CREATE INDEX "SocialCompletion_expiresAt_idx" ON "SocialCompletion"("expiresAt");

-- AddForeignKey
ALTER TABLE "SocialIdentity" ADD CONSTRAINT "SocialIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
