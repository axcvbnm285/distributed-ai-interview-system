-- AlterTable
ALTER TABLE "Room"
ADD COLUMN "aiSummary" TEXT NOT NULL DEFAULT '',
ADD COLUMN "latestAiReview" TEXT NOT NULL DEFAULT '',
ADD COLUMN "latestHint" TEXT NOT NULL DEFAULT '',
ADD COLUMN "hintCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RoomQuestion" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'Easy',
    "description" TEXT NOT NULL,
    "starterCode" TEXT NOT NULL DEFAULT '',
    "testCases" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomQuestion_roomId_askedAt_idx" ON "RoomQuestion"("roomId", "askedAt");

-- AddForeignKey
ALTER TABLE "RoomQuestion" ADD CONSTRAINT "RoomQuestion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
