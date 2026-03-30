/*
  Warnings:

  - A unique constraint covering the columns `[resetToken]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_resetToken_key" ON "UserProfile"("resetToken");
