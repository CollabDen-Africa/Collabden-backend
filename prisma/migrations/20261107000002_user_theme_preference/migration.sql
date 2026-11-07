-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Persist the user's theme so it follows them across devices
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';
