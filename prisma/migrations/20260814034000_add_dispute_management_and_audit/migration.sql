-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('PAYMENT', 'ESCROW_MILESTONE', 'AGREEMENT_RELATED', 'PROJECT_COLLABORATION', 'USER_CONDUCT');

-- AlterTable
ALTER TABLE "Dispute" 
ADD COLUMN IF NOT EXISTS "transactionId" TEXT,
ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT,
ADD COLUMN IF NOT EXISTS "category" "DisputeCategory" NOT NULL DEFAULT 'PROJECT_COLLABORATION',
ADD COLUMN IF NOT EXISTS "evidence" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "isFinalized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DisputeDecision" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "resolutionSummary" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "supportingNotes" TEXT,
    "financialAdjustment" JSONB DEFAULT '{}',
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DisputeEvidenceRequest" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "requestedFrom" TEXT NOT NULL,
    "requestDetails" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "submittedFiles" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeEvidenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DisputeMessage" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "senderAdminId" TEXT,
    "senderUserId" TEXT,
    "message" TEXT NOT NULL,
    "attachments" JSONB DEFAULT '[]',
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DisputeAuditLog" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "adminId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" "DisputeStatus",
    "newStatus" "DisputeStatus",
    "details" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DisputeDecision_disputeId_key" ON "DisputeDecision"("disputeId");
CREATE INDEX IF NOT EXISTS "Dispute_reporterId_idx" ON "Dispute"("reporterId");
CREATE INDEX IF NOT EXISTS "Dispute_reportedUserId_idx" ON "Dispute"("reportedUserId");
CREATE INDEX IF NOT EXISTS "Dispute_projectId_idx" ON "Dispute"("projectId");
CREATE INDEX IF NOT EXISTS "Dispute_assignedAdminId_idx" ON "Dispute"("assignedAdminId");
CREATE INDEX IF NOT EXISTS "Dispute_status_idx" ON "Dispute"("status");
CREATE INDEX IF NOT EXISTS "Dispute_category_idx" ON "Dispute"("category");
CREATE INDEX IF NOT EXISTS "Dispute_createdAt_idx" ON "Dispute"("createdAt");

CREATE INDEX IF NOT EXISTS "DisputeEvidenceRequest_disputeId_idx" ON "DisputeEvidenceRequest"("disputeId");
CREATE INDEX IF NOT EXISTS "DisputeMessage_disputeId_idx" ON "DisputeMessage"("disputeId");
CREATE INDEX IF NOT EXISTS "DisputeAuditLog_disputeId_idx" ON "DisputeAuditLog"("disputeId");
CREATE INDEX IF NOT EXISTS "DisputeAuditLog_createdAt_idx" ON "DisputeAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeDecision" ADD CONSTRAINT "DisputeDecision_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisputeDecision" ADD CONSTRAINT "DisputeDecision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeEvidenceRequest" ADD CONSTRAINT "DisputeEvidenceRequest_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisputeEvidenceRequest" ADD CONSTRAINT "DisputeEvidenceRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeEvidenceRequest" ADD CONSTRAINT "DisputeEvidenceRequest_requestedFrom_fkey" FOREIGN KEY ("requestedFrom") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeMessage" ADD CONSTRAINT "DisputeMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisputeMessage" ADD CONSTRAINT "DisputeMessage_senderAdminId_fkey" FOREIGN KEY ("senderAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeMessage" ADD CONSTRAINT "DisputeMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeAuditLog" ADD CONSTRAINT "DisputeAuditLog_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisputeAuditLog" ADD CONSTRAINT "DisputeAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeAuditLog" ADD CONSTRAINT "DisputeAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
