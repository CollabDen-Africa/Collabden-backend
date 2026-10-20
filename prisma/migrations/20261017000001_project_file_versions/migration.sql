-- AlterTable: ProjectFile — add uploader, duration, and currentVersion pointer
ALTER TABLE "ProjectFile" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "ProjectFile" ADD COLUMN "uploaderId" TEXT;
ALTER TABLE "ProjectFile" ADD COLUMN "currentVersionId" TEXT;

CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");
CREATE UNIQUE INDEX "ProjectFile_currentVersionId_key" ON "ProjectFile"("currentVersionId");

ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ProjectFileVersion
CREATE TABLE "ProjectFileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFileVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectFileVersion_fileId_versionNumber_key" ON "ProjectFileVersion"("fileId", "versionNumber");
CREATE INDEX "ProjectFileVersion_fileId_idx" ON "ProjectFileVersion"("fileId");

ALTER TABLE "ProjectFileVersion" ADD CONSTRAINT "ProjectFileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFileVersion" ADD CONSTRAINT "ProjectFileVersion_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing ProjectFile becomes its own first ProjectFileVersion
INSERT INTO "ProjectFileVersion" ("id", "fileId", "uploaderId", "versionNumber", "name", "url", "size", "type", "durationSeconds", "createdAt")
SELECT
  'v_' || "id",
  "id",
  NULL,
  1,
  "name",
  "url",
  COALESCE("size", 0),
  "type",
  NULL,
  "createdAt"
FROM "ProjectFile";

UPDATE "ProjectFile" pf
SET "currentVersionId" = pfv."id"
FROM "ProjectFileVersion" pfv
WHERE pfv."fileId" = pf."id" AND pfv."versionNumber" = 1;

-- AddForeignKey after backfill so NULLs never violate it
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ProjectFileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
