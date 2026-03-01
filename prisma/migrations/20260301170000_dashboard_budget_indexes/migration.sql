-- AlterTable
ALTER TABLE "BudgetPlan"
  ADD COLUMN "monthlyLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "yearlyLimit" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_accountType_idx" ON "FinancialAccount"("userId", "accountType");
CREATE INDEX "JournalEntry_userId_transactionDate_idx" ON "JournalEntry"("userId", "transactionDate");
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");
CREATE INDEX "JournalLine_categoryId_idx" ON "JournalLine"("categoryId");
CREATE INDEX "Category_userId_kind_bucket_idx" ON "Category"("userId", "kind", "bucket");
CREATE INDEX "LendingRecord_userId_kind_status_idx" ON "LendingRecord"("userId", "kind", "status");
CREATE INDEX "BudgetPlan_userId_createdAt_idx" ON "BudgetPlan"("userId", "createdAt");
