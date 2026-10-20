-- CreateTable: DirectMessageAttachment
CREATE TABLE "DirectMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DirectMessageAttachment_messageId_idx" ON "DirectMessageAttachment"("messageId");

ALTER TABLE "DirectMessageAttachment"
  ADD CONSTRAINT "DirectMessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
