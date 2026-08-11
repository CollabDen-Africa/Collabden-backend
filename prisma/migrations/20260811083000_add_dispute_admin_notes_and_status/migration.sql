-- AlterEnum
ALTER TYPE "DisputeStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "DisputeStatus" ADD VALUE 'AWAITING_RESPONSE';

-- AlterTable
ALTER TABLE "AdminNote" ADD COLUMN "targetDisputeId" TEXT;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_targetDisputeId_fkey" FOREIGN KEY ("targetDisputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
