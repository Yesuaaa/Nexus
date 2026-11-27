CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "vendor" VARCHAR(300),
  "reference" VARCHAR(300),
  "note" VARCHAR(2000),
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "Expense_currency_php" CHECK ("currency" = 'PHP')
);
CREATE INDEX "Expense_expenseDate_id_idx" ON "Expense"("expenseDate", "id");
CREATE INDEX "Expense_category_expenseDate_idx" ON "Expense"("category", "expenseDate");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
