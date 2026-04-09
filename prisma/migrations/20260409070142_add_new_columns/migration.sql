/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_googleId_key" ON "UserProfile"("googleId");
