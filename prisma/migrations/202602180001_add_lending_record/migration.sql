-- CreateEnum
CREATE TYPE "LendingKind" AS ENUM ('LENT', 'LOAN');

-- CreateEnum
CREATE TYPE "LendingStatus" AS ENUM ('OPEN', 'SETTLED', 'WRITTEN_OFF');

-- CreateTable
CREATE TABLE "LendingRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "kind" "LendingKind" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "LendingStatus" NOT NULL DEFAULT 'OPEN',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LendingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LendingRecord_profileId_kind_status_idx" ON "LendingRecord"("profileId", "kind", "status");

-- CreateIndex
CREATE INDEX "LendingRecord_profileId_dueDate_idx" ON "LendingRecord"("profileId", "dueDate");

-- AddForeignKey
ALTER TABLE "LendingRecord" ADD CONSTRAINT "LendingRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
