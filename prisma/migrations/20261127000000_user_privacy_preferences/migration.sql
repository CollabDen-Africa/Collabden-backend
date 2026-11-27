-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DisplayNameMode" AS ENUM ('LEGAL', 'STAGE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MessagePrivacy" AS ENUM ('EVERYONE', 'CONNECTIONS', 'PROJECT_COLLABORATORS', 'NOBODY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Which name is shown in collaborative/public spaces: legal (firstName + lastName) or stage (displayName).
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "displayNameMode" "DisplayNameMode" NOT NULL DEFAULT 'LEGAL';

-- Who is allowed to initiate a chat or message request with this user.
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "whoCanMessage" "MessagePrivacy" NOT NULL DEFAULT 'EVERYONE';

-- Whether the user's location is visible on their public profile.
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "showLocation" BOOLEAN NOT NULL DEFAULT true;
