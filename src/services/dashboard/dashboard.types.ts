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

export type DashboardMetricCard = {
  id: string
  name: string
  amount: number
  href: string
}

export type DashboardTodaySummary = {
  dateLabel: string
  income: number
  expense: number
  cardTotals: DashboardMetricCard[]
}

export type DashboardBudgetSummary = {
  monthly: number
  yearly: number
}

export type DashboardAnalyticsPoint = {
  name: string
  income: number
  expense: number
}

export type DashboardData = {
  userName: string
  profilePhoto: string
  monthLabel: string
  balance: number
  income: number
  expense: number
  metricCards: DashboardMetricCard[]
  todaySummary: DashboardTodaySummary
  budgetSummary: DashboardBudgetSummary
  jobs: unknown[]
  shortcuts: unknown[]
  activity: unknown[]
  bills: unknown[]
  transactions: unknown[]
  budgets: Array<{ id: string; name: string; monthlyLimit: number; yearlyLimit: number; used: number; usageRatio: number }>
  analytics: DashboardAnalyticsPoint[]
  insights: {
    financialHealth: FinancialHealthResponse
    netWorth: NetWorthResponse
    expenseBreakdown: ExpenseBreakdownItem[]
    alerts: DashboardAlert[]
    prediction: PredictionResponse
    lendingSummary: LendingSummaryResponse
  }
  ledgerCategoriesState: {
    message: string | null
    retryable: boolean
  }
}
