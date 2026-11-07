-- Add CANCELLED to AgreementStatus enum
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add agreement cancellation notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGREEMENT_CANCELLATION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGREEMENT_CANCELLATION_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGREEMENT_CANCELLED';

-- Mutual cancellation tracking on LegalAgreement
ALTER TABLE "LegalAgreement" ADD COLUMN IF NOT EXISTS "cancellationRequestedById" TEXT;
ALTER TABLE "LegalAgreement" ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP(3);
ALTER TABLE "LegalAgreement" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "LegalAgreement" ADD COLUMN IF NOT EXISTS "cancellationApprovals" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LegalAgreement" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
