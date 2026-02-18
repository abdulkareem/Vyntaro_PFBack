export type FinancialHealthLabel = 'Good' | 'Average' | 'Risky'

export type FinancialHealthResponse = {
  score: number
  label: FinancialHealthLabel
}

export type NetWorthResponse = {
  netWorth: number
  savingsThisMonth: number
}

export type ExpenseBreakdownItem = {
  category: string
  amount: number
}

export type AlertType = 'warning' | 'info' | 'success'

export type DashboardAlert = {
  type: AlertType
  message: string
}

export type PredictionResponse = {
  projectedBalance: number
}

export type LendingBreakdownItem = {
  person: string
  amount: number
  kind: 'lent' | 'loan'
  overdue: boolean
  dueDate?: string
}

export type AgingBucketName = '0-30' | '31-60' | '61-90' | '90+'

export type LendingAgingBucket = {
  bucket: AgingBucketName
  count: number
  amount: number
}

export type LendingSummaryResponse = {
  totalLent: number
  totalLoan: number
  breakdown: LendingBreakdownItem[]
  agingBuckets: LendingAgingBucket[]
}

export type MonthlyIncomeExpense = {
  income: number
  expense: number
}
