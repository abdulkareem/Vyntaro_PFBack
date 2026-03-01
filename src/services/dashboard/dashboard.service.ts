import { LendingKind } from '@prisma/client'
import {
  getBudgetPlans,
  getCategoryMonthlyTotals,
  getDashboardCardCategoryMap,
  getExpenseBreakdownRaw,
  getLendingRecords,
  getMonthlyIncomeExpenseRaw,
  getMonthlyTrend,
  getTodayIncomeExpense,
  getUserCategoriesCount,
  getUserHeader,
  getRecentTransactions,
  toNumber
} from './dashboard.repository.js'
import { computeFinancialHealthScore } from './dashboard.logic.js'
import type {
  DashboardAlert,
  DashboardData,
  DashboardMetricCard,
  ExpenseBreakdownItem,
  FinancialHealthResponse,
  LendingSummaryResponse,
  NetWorthResponse,
  PredictionResponse
} from './dashboard.types.js'

export function computeBudgetUsage(expense: number, budget: number): number {
  if (budget <= 0) return 0
  return Math.max(0, Math.min(1, expense / budget))
}

export function computeBalance(income: number, expense: number): number {
  return income - expense
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function dateLabel(date = new Date()): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export async function getMonthlyIncomeExpense(userId: string, month: number, year: number) {
  return getMonthlyIncomeExpenseRaw(userId, year, month)
}

export async function getLendingSummary(userId: string): Promise<LendingSummaryResponse> {
  const records = await getLendingRecords(userId)
  const totalLent = records.filter((row) => row.kind === LendingKind.LENT).reduce((sum, row) => sum + toNumber(row.currentBalance), 0)
  const totalLoan = records.filter((row) => row.kind === LendingKind.LOAN).reduce((sum, row) => sum + toNumber(row.currentBalance), 0)

  return {
    totalLent,
    totalLoan,
    breakdown: records.map((row) => ({
      person: row.person,
      amount: toNumber(row.currentBalance),
      kind: row.kind === LendingKind.LENT ? 'lent' : 'loan',
      overdue: false
    })),
    agingBuckets: [
      { bucket: '0-30', count: records.length, amount: totalLoan },
      { bucket: '31-60', count: 0, amount: 0 },
      { bucket: '61-90', count: 0, amount: 0 },
      { bucket: '90+', count: 0, amount: 0 }
    ]
  }
}

export async function getNetWorthSummary(userId: string, month: number, year: number): Promise<NetWorthResponse> {
  const totals = await getMonthlyIncomeExpense(userId, month, year)
  return {
    netWorth: computeBalance(totals.income, totals.expense),
    savingsThisMonth: computeBalance(totals.income, totals.expense)
  }
}

export async function getExpenseBreakdown(userId: string, month: number, year: number): Promise<ExpenseBreakdownItem[]> {
  return getExpenseBreakdownRaw(userId, year, month)
}

export async function generateDashboardAlerts(userId: string, month: number, year: number): Promise<DashboardAlert[]> {
  const { income, expense } = await getMonthlyIncomeExpense(userId, month, year)
  if (income === 0 && expense === 0) return []
  if (expense > income) return [{ type: 'warning', message: 'Expenses exceed income for this month.' }]
  return [{ type: 'success', message: 'You are cashflow positive for this month.' }]
}

export async function getMonthlyPrediction(userId: string, month: number, year: number): Promise<PredictionResponse> {
  const { income, expense } = await getMonthlyIncomeExpense(userId, month, year)
  return { projectedBalance: computeBalance(income, expense) }
}

export async function calculateFinancialHealth(userId: string, month: number, year: number): Promise<FinancialHealthResponse> {
  const [totals, lending, budgets] = await Promise.all([
    getMonthlyIncomeExpense(userId, month, year),
    getLendingSummary(userId),
    getBudgetPlans(userId)
  ])

  const monthlyBudget = budgets.reduce((sum, budget) => sum + toNumber(budget.monthlyLimit), 0)

  return computeFinancialHealthScore({
    income: totals.income,
    expense: totals.expense,
    lendingExposure: lending.totalLent + lending.totalLoan,
    budgetUtilization: computeBudgetUsage(totals.expense, monthlyBudget)
  })
}

export async function getMetricCards(userId: string, month: number, year: number): Promise<DashboardMetricCard[]> {
  const categories = await getDashboardCardCategoryMap(userId)
  const totals = await getCategoryMonthlyTotals(userId, year, month, categories.map((row) => row.id))
  const totalByCategory = new Map(totals.map((row) => [row.categoryId ?? '', toNumber(row._sum.amount)]))

  const base = categories.map((category) => ({
    id: category.id,
    name: category.name,
    amount: totalByCategory.get(category.id) ?? 0,
    href: `/dashboard/categories/${category.id}`
  }))

  const existingNames = new Set(base.map((card) => card.name.toLowerCase()))
  for (const fallback of ['Charity', 'Loan', 'Money Lent']) {
    if (!existingNames.has(fallback.toLowerCase())) {
      base.push({ id: fallback.toLowerCase().replaceAll(' ', '-'), name: fallback, amount: 0, href: '/dashboard' })
    }
  }

  return base
}

export async function getDashboardSummary(userId: string, month: number, year: number): Promise<DashboardData> {
  const [header, monthlyTotals, todayTotals, metricCards, budgetsRaw, analytics, netWorth, expenseBreakdown, alerts, prediction, lendingSummary, financialHealth, categoryCount, transactions] = await Promise.all([
    getUserHeader(userId),
    getMonthlyIncomeExpense(userId, month, year),
    getTodayIncomeExpense(userId),
    getMetricCards(userId, month, year),
    getBudgetPlans(userId),
    getMonthlyTrend(userId, year, month),
    getNetWorthSummary(userId, month, year),
    getExpenseBreakdown(userId, month, year),
    generateDashboardAlerts(userId, month, year),
    getMonthlyPrediction(userId, month, year),
    getLendingSummary(userId),
    calculateFinancialHealth(userId, month, year),
    getUserCategoriesCount(userId),
    getRecentTransactions(userId, month, year)
  ])

  const monthlyBudget = budgetsRaw.reduce((sum, budget) => sum + toNumber(budget.monthlyLimit), 0)
  const yearlyBudget = budgetsRaw.reduce((sum, budget) => sum + toNumber(budget.yearlyLimit), 0)
  const usedRatio = computeBudgetUsage(monthlyTotals.expense, monthlyBudget)

  return {
    userName: header?.email ?? header?.phone ?? 'User',
    profilePhoto: '',
    monthLabel: monthLabel(year, month),
    balance: computeBalance(monthlyTotals.income, monthlyTotals.expense),
    income: monthlyTotals.income,
    expense: monthlyTotals.expense,
    metricCards,
    todaySummary: {
      dateLabel: dateLabel(),
      income: todayTotals.income,
      expense: todayTotals.expense,
      cardTotals: metricCards
    },
    budgetSummary: { monthly: monthlyBudget, yearly: yearlyBudget },
    jobs: [],
    shortcuts: [],
    activity: [],
    bills: [],
    transactions,
    budgets: budgetsRaw.map((budget) => ({
      id: budget.id,
      name: budget.name,
      monthlyLimit: toNumber(budget.monthlyLimit),
      yearlyLimit: toNumber(budget.yearlyLimit),
      used: monthlyTotals.expense,
      usageRatio: usedRatio
    })),
    analytics,
    insights: {
      financialHealth,
      netWorth,
      expenseBreakdown,
      alerts,
      prediction,
      lendingSummary
    },
    ledgerCategoriesState: {
      message: categoryCount === 0 ? 'No categories configured yet.' : null,
      retryable: false
    }
  }
}
