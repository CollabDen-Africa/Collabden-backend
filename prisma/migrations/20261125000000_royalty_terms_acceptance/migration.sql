-- CreateEnum: collaborators must accept their royalty split before signing agreements
CREATE TYPE "RoyaltyApprovalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable: ProjectRoyaltySplit — per-collaborator acceptance of royalty terms
ALTER TABLE "ProjectRoyaltySplit" ADD COLUMN "approvalStatus" "RoyaltyApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvalComment" TEXT,
ADD COLUMN "respondedAt" TIMESTAMP(3);

-- Owners set the terms, so their own splits count as accepted.
UPDATE "ProjectRoyaltySplit" s
SET "approvalStatus" = 'ACCEPTED', "respondedAt" = NOW()
FROM "Project" p
WHERE s."projectId" = p."id" AND s."userId" = p."ownerId";

-- AlterTable: AgreementSignature — record the royalty share accepted at signing time
ALTER TABLE "AgreementSignature" ADD COLUMN "royaltyShare" DECIMAL(5,2);

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ROYALTY_TERMS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'ROYALTY_TERMS_RESPONDED';
