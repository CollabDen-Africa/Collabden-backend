-- AlterEnum
ALTER TYPE "IdentityVerificationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "IdentityVerificationStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE';

-- AlterTable
ALTER TABLE "IdentityVerificationRequest" ADD COLUMN IF NOT EXISTS "verificationType" TEXT NOT NULL DEFAULT 'GOVERNMENT_ID',
ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "reviewedByAdminId" TEXT,
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdentityVerificationRequest_userId_idx" ON "IdentityVerificationRequest"("userId");
CREATE INDEX IF NOT EXISTS "IdentityVerificationRequest_status_idx" ON "IdentityVerificationRequest"("status");
CREATE INDEX IF NOT EXISTS "IdentityVerificationRequest_verificationType_idx" ON "IdentityVerificationRequest"("verificationType");
CREATE INDEX IF NOT EXISTS "IdentityVerificationRequest_createdAt_idx" ON "IdentityVerificationRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "IdentityVerificationRequest" ADD CONSTRAINT "IdentityVerificationRequest_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
