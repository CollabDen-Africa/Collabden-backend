-- One-NIN-per-account enforcement + verification timestamp.
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "ninHash" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "identityVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_ninHash_key" ON "UserProfile"("ninHash");
