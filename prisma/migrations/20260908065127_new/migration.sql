/*
  Warnings:

  - You are about to drop the column `feedbackCount` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastFeedbackAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `feedbacks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "feedbackCount",
DROP COLUMN "lastFeedbackAt";

-- DropTable
DROP TABLE "feedbacks";

-- DropEnum
DROP TYPE "FeedbackStatus";

-- DropEnum
DROP TYPE "MediaType";

-- CreateTable
CREATE TABLE "reply_map" (
    "adminMessageId" BIGINT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "senderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_map_pkey" PRIMARY KEY ("adminMessageId")
);
