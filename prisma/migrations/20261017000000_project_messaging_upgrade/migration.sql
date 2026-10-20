-- CreateEnum
CREATE TYPE "ProjectMessageType" AS ENUM ('TEXT', 'VOICE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_MESSAGE';

-- AlterTable: ProjectMessage
ALTER TABLE "ProjectMessage" ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "ProjectMessage" ADD COLUMN "messageType" "ProjectMessageType" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "ProjectMessage" ADD COLUMN "voiceUrl" TEXT;
ALTER TABLE "ProjectMessage" ADD COLUMN "voiceDuration" INTEGER;
ALTER TABLE "ProjectMessage" ADD COLUMN "parentId" TEXT;
ALTER TABLE "ProjectMessage" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ProjectMessage_projectId_idx" ON "ProjectMessage"("projectId");
CREATE INDEX "ProjectMessage_senderId_idx" ON "ProjectMessage"("senderId");
CREATE INDEX "ProjectMessage_parentId_idx" ON "ProjectMessage"("parentId");

-- AddForeignKey
ALTER TABLE "ProjectMessage" ADD CONSTRAINT "ProjectMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMessage" ADD CONSTRAINT "ProjectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProjectMessageAttachment
CREATE TABLE "ProjectMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectMessageAttachment_messageId_idx" ON "ProjectMessageAttachment"("messageId");

ALTER TABLE "ProjectMessageAttachment" ADD CONSTRAINT "ProjectMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ProjectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProjectMessageReaction
CREATE TABLE "ProjectMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMessageReaction_messageId_userId_emoji_key" ON "ProjectMessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "ProjectMessageReaction_messageId_idx" ON "ProjectMessageReaction"("messageId");

ALTER TABLE "ProjectMessageReaction" ADD CONSTRAINT "ProjectMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ProjectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMessageReaction" ADD CONSTRAINT "ProjectMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProjectMessageRead
CREATE TABLE "ProjectMessageRead" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMessageRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMessageRead_messageId_userId_key" ON "ProjectMessageRead"("messageId", "userId");
CREATE INDEX "ProjectMessageRead_userId_idx" ON "ProjectMessageRead"("userId");

ALTER TABLE "ProjectMessageRead" ADD CONSTRAINT "ProjectMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ProjectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMessageRead" ADD CONSTRAINT "ProjectMessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
