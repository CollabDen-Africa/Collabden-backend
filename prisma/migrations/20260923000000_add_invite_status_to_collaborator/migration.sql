-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable: add inviteStatus column, change isActive default to false
ALTER TABLE "ProjectCollaborator"
  ADD COLUMN "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'PENDING';

-- Update existing rows: owners stay ACCEPTED + active, all others become ACCEPTED + active
-- (existing rows are all real collaborators already, so we mark them ACCEPTED)
UPDATE "ProjectCollaborator" SET "inviteStatus" = 'ACCEPTED' WHERE "isActive" = true;

-- Change default for isActive to false for NEW records (existing rows unchanged)
ALTER TABLE "ProjectCollaborator" ALTER COLUMN "isActive" SET DEFAULT false;
