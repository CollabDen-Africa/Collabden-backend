-- AlterTable: Project — when the owner marked it completed
ALTER TABLE "Project" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill: projects already COMPLETED get their last update time
UPDATE "Project" SET "completedAt" = "updatedAt" WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;

-- CreateEnum
CREATE TYPE "EndorsementType" AS ENUM ('SKILL', 'TESTIMONIAL');

-- AlterTable: Endorsement — skill endorsements, ratings and recipient-controlled visibility.
-- Existing rows become TESTIMONIAL (the default).
ALTER TABLE "Endorsement" ADD COLUMN "type" "EndorsementType" NOT NULL DEFAULT 'TESTIMONIAL',
ADD COLUMN "skill" TEXT,
ADD COLUMN "rating" INTEGER,
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "content" DROP NOT NULL;

ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));

-- Remove duplicate project testimonials (only possible via concurrent requests), keeping the earliest.
DELETE FROM "Endorsement" e
USING "Endorsement" older
WHERE e."type" = 'TESTIMONIAL'
  AND older."type" = 'TESTIMONIAL'
  AND e."projectId" IS NOT NULL
  AND e."endorserId" = older."endorserId"
  AND e."recipientId" = older."recipientId"
  AND e."projectId" = older."projectId"
  AND (e."createdAt", e."id") > (older."createdAt", older."id");

-- CreateIndex: one skill endorsement per endorser/recipient/project/skill (case-insensitive)
CREATE UNIQUE INDEX "Endorsement_skill_unique"
  ON "Endorsement" ("endorserId", "recipientId", "projectId", lower("skill"))
  WHERE "type" = 'SKILL';

-- CreateIndex: one testimonial per endorser/recipient/project
CREATE UNIQUE INDEX "Endorsement_testimonial_unique"
  ON "Endorsement" ("endorserId", "recipientId", "projectId")
  WHERE "type" = 'TESTIMONIAL' AND "projectId" IS NOT NULL;

CREATE INDEX "Endorsement_recipientId_idx" ON "Endorsement"("recipientId");
CREATE INDEX "Endorsement_endorserId_idx" ON "Endorsement"("endorserId");

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ENDORSEMENT_RECEIVED';
