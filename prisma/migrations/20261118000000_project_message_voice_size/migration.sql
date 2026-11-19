-- AlterTable: ProjectMessage — track voice note size for storage quota accounting
ALTER TABLE "ProjectMessage" ADD COLUMN "voiceSize" INTEGER;
