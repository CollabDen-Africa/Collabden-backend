-- CreateEnum
CREATE TYPE "SubscriptionActivityType" AS ENUM ('UPGRADE', 'DOWNGRADE', 'CANCELLATION', 'RENEWAL', 'INITIAL_SUBSCRIBE');

-- CreateEnum
CREATE TYPE "PaymentRetryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionIssueStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionIssueCategory" AS ENUM ('BILLING_ERROR', 'PAYMENT_FAILED', 'PLAN_ACCESS_ISSUE', 'REFUND_REQUEST', 'CANCELLATION_ISSUE', 'OTHER');

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "limits" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "AdminNote" ADD COLUMN IF NOT EXISTS "targetSubscriptionIssueId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubscriptionActivity" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SubscriptionActivityType" NOT NULL,
    "fromTier" "SubscriptionTier",
    "toTier" "SubscriptionTier",
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "reason" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubscriptionPaymentRetry" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "PaymentRetryStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "txRef" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPaymentRetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubscriptionIssue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "category" "SubscriptionIssueCategory" NOT NULL DEFAULT 'BILLING_ERROR',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SubscriptionIssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionActivity_subscriptionId_idx" ON "SubscriptionActivity"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionActivity_userId_idx" ON "SubscriptionActivity"("userId");
CREATE INDEX IF NOT EXISTS "SubscriptionActivity_type_idx" ON "SubscriptionActivity"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionPaymentRetry_userId_idx" ON "SubscriptionPaymentRetry"("userId");
CREATE INDEX IF NOT EXISTS "SubscriptionPaymentRetry_subscriptionId_idx" ON "SubscriptionPaymentRetry"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPaymentRetry_status_idx" ON "SubscriptionPaymentRetry"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionIssue_userId_idx" ON "SubscriptionIssue"("userId");
CREATE INDEX IF NOT EXISTS "SubscriptionIssue_status_idx" ON "SubscriptionIssue"("status");
CREATE INDEX IF NOT EXISTS "SubscriptionIssue_category_idx" ON "SubscriptionIssue"("category");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_targetSubscriptionIssueId_fkey" FOREIGN KEY ("targetSubscriptionIssueId") REFERENCES "SubscriptionIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionActivity" ADD CONSTRAINT "SubscriptionActivity_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionActivity" ADD CONSTRAINT "SubscriptionActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentRetry" ADD CONSTRAINT "SubscriptionPaymentRetry_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRetry" ADD CONSTRAINT "SubscriptionPaymentRetry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRetry" ADD CONSTRAINT "SubscriptionPaymentRetry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionIssue" ADD CONSTRAINT "SubscriptionIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionIssue" ADD CONSTRAINT "SubscriptionIssue_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionIssue" ADD CONSTRAINT "SubscriptionIssue_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
