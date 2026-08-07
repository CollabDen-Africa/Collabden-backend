-- AlterTable: Add agreementId to Report
ALTER TABLE "Report" ADD COLUMN "agreementId" TEXT;

-- AlterTable: Add targetAgreementId to AdminNote
ALTER TABLE "AdminNote" ADD COLUMN "targetAgreementId" TEXT;

-- AddForeignKey: Report -> LegalAgreement
ALTER TABLE "Report" ADD CONSTRAINT "Report_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "LegalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: AdminNote -> LegalAgreement
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_targetAgreementId_fkey" FOREIGN KEY ("targetAgreementId") REFERENCES "LegalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
