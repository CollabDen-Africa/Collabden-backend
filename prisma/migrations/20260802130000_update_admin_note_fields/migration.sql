-- AlterTable: Make userId optional and add targetUserId, targetProjectId to AdminNote
ALTER TABLE "AdminNote" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AdminNote" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT;
ALTER TABLE "AdminNote" ADD COLUMN IF NOT EXISTS "targetProjectId" TEXT;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminNote_targetUserId_fkey') THEN
        ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminNote_targetProjectId_fkey') THEN
        ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END;
$$;
