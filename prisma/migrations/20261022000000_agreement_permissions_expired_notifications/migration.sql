-- Add EXPIRED to AgreementStatus enum
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Add AGREEMENT_UPLOADED, AGREEMENT_PENDING_SIGNATURE, AGREEMENT_SIGNED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGREEMENT_UPLOADED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGREEMENT_PENDING_SIGNATURE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGREEMENT_SIGNED';

-- Add expiresAt to LegalAgreement
ALTER TABLE "LegalAgreement" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateTable: AgreementPermission
CREATE TABLE IF NOT EXISTS "AgreementPermission" (
    "id"          TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "canView"     BOOLEAN NOT NULL DEFAULT true,
    "canSign"     BOOLEAN NOT NULL DEFAULT true,
    "canEdit"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgreementPermission_agreementId_userId_key"
    ON "AgreementPermission"("agreementId", "userId");

CREATE INDEX IF NOT EXISTS "AgreementPermission_agreementId_idx" ON "AgreementPermission"("agreementId");
CREATE INDEX IF NOT EXISTS "AgreementPermission_userId_idx"      ON "AgreementPermission"("userId");

ALTER TABLE "AgreementPermission"
    ADD CONSTRAINT "AgreementPermission_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "LegalAgreement"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgreementPermission"
    ADD CONSTRAINT "AgreementPermission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
