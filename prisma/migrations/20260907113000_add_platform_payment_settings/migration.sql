-- Operational payment configuration only. Provider credentials remain in
-- environment-managed secret storage and are intentionally not represented here.
CREATE TABLE "PlatformPaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "transactionFeePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "transactionFeeFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimumWithdrawalAmount" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "maximumWithdrawalAmount" DECIMAL(12,2) NOT NULL DEFAULT 1000000,
    "supportedPaymentMethods" TEXT[] NOT NULL DEFAULT ARRAY['CARD', 'BANK_TRANSFER', 'USSD']::TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformPaymentSettings_pkey" PRIMARY KEY ("id")
);
