-- DropIndex
DROP INDEX "Score_easyBestStreak_idx";
DROP INDEX "Score_hardBestStreak_idx";

-- AlterTable
ALTER TABLE "Score"
  DROP COLUMN "easyCurrentStreak",
  DROP COLUMN "easyBestStreak",
  DROP COLUMN "hardCurrentStreak",
  DROP COLUMN "hardBestStreak",
  ADD COLUMN "easyScore"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "easyConsecutiveWins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "hardScore"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "hardConsecutiveWins" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Score_easyScore_idx" ON "Score"("easyScore");
CREATE INDEX "Score_hardScore_idx" ON "Score"("hardScore");
