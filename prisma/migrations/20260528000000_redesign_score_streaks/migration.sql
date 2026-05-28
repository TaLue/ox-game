-- DropIndex
DROP INDEX "Score_totalScore_idx";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "pointsDelta";

-- AlterTable
ALTER TABLE "Score" DROP COLUMN "currentStreak",
DROP COLUMN "totalScore",
ADD COLUMN     "easyBestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "easyCurrentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hardBestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hardCurrentStreak" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Score_easyBestStreak_idx" ON "Score"("easyBestStreak");

-- CreateIndex
CREATE INDEX "Score_hardBestStreak_idx" ON "Score"("hardBestStreak");
