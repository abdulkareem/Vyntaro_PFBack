import crypto from 'node:crypto'
import { AccountType, LendingKind, LendingStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import type {
  DashboardAlert,
  ExpenseBreakdownItem,
  FinancialHealthResponse,
  LendingAgingBucket,
  LendingSummaryResponse,
  MonthlyIncomeExpense,
  NetWorthResponse,
  PredictionResponse
} from './dashboard.types.js'
import { computeFinancialHealthScore, getAgingBucket } from './dashboard.logic.js'

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function toNumber(value: Prisma.Decimal | null | undefined): number {
  return Number(value ?? 0)
}

async function getAccountBalancesByType(userId: string, upToDate: Date) {
  const accounts = await prisma.financialAccount.findMany({
    where: { userId },
    select: {
      id: true,
      accountType: true,
      openingBalance: true,
      journalLines: {
        where: { journalEntry: { transactionDate: { lte: upToDate } } },
        select: { direction: true, amount: true }
      }
    }
  })

  const totals = {
    asset: 0,
    liability: 0,
    income: 0,
    expense: 0
  }

  for (const account of accounts) {
    let balance = toNumber(account.openingBalance)

    for (const line of account.journalLines) {
      const amount = toNumber(line.amount)
      const debitIncreases =
        account.accountType === AccountType.ASSET || account.accountType === AccountType.EXPENSE
      balance += line.direction === 'DEBIT' ? (debitIncreases ? amount : -amount) : debitIncreases ? -amount : amount
    }

    if (account.accountType === AccountType.ASSET) totals.asset += balance
    if (account.accountType === AccountType.LIABILITY) totals.liability += balance
    if (account.accountType === AccountType.INCOME) totals.income += balance
    if (account.accountType === AccountType.EXPENSE) totals.expense += balance
  }

  return totals
}

export async function getMonthlyIncomeExpense(
  userId: string,
  month: number,
  year: number
): Promise<MonthlyIncomeExpense> {
  const start = startOfMonth(year, month)
  const end = endOfMonth(year, month)

  const byType = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      journalEntry: { userId, transactionDate: { gte: start, lte: end } }
    },
    _sum: { amount: true }
  })

  if (byType.length === 0) return { income: 0, expense: 0 }

  const accounts = await prisma.financialAccount.findMany({
    where: { id: { in: byType.map((row) => row.accountId) } },
    select: { id: true, accountType: true }
  })

  const typeById = new Map(accounts.map((a) => [a.id, a.accountType]))
  return byType.reduce(
    (acc, row) => {
      const accountType = typeById.get(row.accountId)
      const amount = toNumber(row._sum.amount)
      if (accountType === AccountType.INCOME) acc.income += amount
      if (accountType === AccountType.EXPENSE) acc.expense += amount
      return acc
    },
    { income: 0, expense: 0 }
  )
}

export async function getLendingSummary(
  userId: string,
  month: number,
  year: number
): Promise<LendingSummaryResponse> {
  const records = await prisma.lendingRecord.findMany({
    where: {
      userId,
      status: { in: [LendingStatus.OPEN, LendingStatus.WRITTEN_OFF] }
    },
    orderBy: { person: 'asc' }
  })

  const breakdown = records.map((record) => {
    const amount = toNumber(record.currentBalance)
    const overdue = false
    return {
      person: record.person,
      amount,
      kind: (record.kind === LendingKind.LENT ? 'lent' : 'loan') as 'lent' | 'loan',
      overdue
    }
  })

  const totalLent = records
    .filter((record) => record.kind === LendingKind.LENT)
    .reduce((sum, record) => sum + toNumber(record.currentBalance), 0)
  const totalLoan = records
    .filter((record) => record.kind === LendingKind.LOAN)
    .reduce((sum, record) => sum + toNumber(record.currentBalance), 0)

  const agingBuckets = emptyAgingBuckets()
  for (const record of records) {
    if (record.kind !== LendingKind.LOAN) continue
    const amount = toNumber(record.currentBalance)
    if (amount <= 0) continue

    const bucket = getAgingBucket(0)
    const target = agingBuckets.find((entry) => entry.bucket === bucket)
    if (target) {
      target.count += 1
      target.amount += amount
    }
  }

  return { totalLent, totalLoan, breakdown, agingBuckets }
}

function emptyAgingBuckets(): LendingAgingBucket[] {
  return [
    { bucket: '0-30', count: 0, amount: 0 },
    { bucket: '31-60', count: 0, amount: 0 },
    { bucket: '61-90', count: 0, amount: 0 },
    { bucket: '90+', count: 0, amount: 0 }
  ]
}

export async function calculateFinancialHealth(
  userId: string,
  month: number,
  year: number
): Promise<FinancialHealthResponse> {
  const { income, expense } = await getMonthlyIncomeExpense(userId, month, year)
  const lending = await getLendingSummary(userId, month, year)

  const budgetUtilization = 0

  return computeFinancialHealthScore({
    income,
    expense,
    lendingExposure: lending.totalLoan + lending.totalLent,
    budgetUtilization
  })
}

export async function getNetWorthSummary(
  userId: string,
  month: number,
  year: number
): Promise<NetWorthResponse> {
  const monthEnd = endOfMonth(year, month)
  const balances = await getAccountBalancesByType(userId, monthEnd)
  const { income, expense } = await getMonthlyIncomeExpense(userId, month, year)

  return {
    netWorth: balances.asset - balances.liability,
    savingsThisMonth: income - expense
  }
}

export async function getExpenseBreakdown(
  userId: string,
  month: number,
  year: number
): Promise<ExpenseBreakdownItem[]> {
  const start = startOfMonth(year, month)
  const end = endOfMonth(year, month)

  const grouped = await prisma.journalLine.groupBy({
    by: ['categoryId'],
    where: {
      journalEntry: { userId, transactionDate: { gte: start, lte: end } },
      account: { accountType: AccountType.EXPENSE },
      categoryId: { not: null }
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } }
  })

  if (grouped.length === 0) return []

  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((row) => row.categoryId).filter((v): v is string => Boolean(v)) } },
    select: { id: true, name: true }
  })
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))

  return grouped
    .map((row) => ({
      category: categoryName.get(row.categoryId ?? '') ?? 'Uncategorized',
      amount: toNumber(row._sum.amount)
    }))
    .sort((a, b) => b.amount - a.amount)
}

export async function generateDashboardAlerts(
  userId: string,
  month: number,
  year: number
): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = []
  const start = startOfMonth(year, month)
  const end = endOfMonth(year, month)
  const { income, expense } = await getMonthlyIncomeExpense(userId, month, year)

  const budgetPlansCount = await prisma.budgetPlan.count({ where: { userId } })
  if (budgetPlansCount > 0 && income > 0 && expense / income > 0.8) {
    alerts.push({ type: 'warning', message: 'Budget usage is above 80% this month.' })
  }

  const prev = previousMonth(year, month)
  const previousExpense = (await getMonthlyIncomeExpense(userId, prev.month, prev.year)).expense
  if (previousExpense > 0 && expense > previousExpense) {
    const growth = Math.round(((expense - previousExpense) / previousExpense) * 100)
    alerts.push({ type: 'warning', message: `Expenses increased by ${growth}% vs previous month.` })
  }

  const charityCategory = await prisma.category.findFirst({
    where: { userId, bucket: 'CHARITY' },
    select: { id: true }
  })
  if (charityCategory) {
    const charityCurrent = await prisma.journalLine.aggregate({
      where: {
        categoryId: charityCategory.id,
        account: { accountType: AccountType.EXPENSE },
        journalEntry: { userId, transactionDate: { gte: start, lte: end } }
      },
      _sum: { amount: true }
    })

    const trailingStart = new Date(Date.UTC(year, month - 4, 1))
    const trailing = await prisma.journalLine.aggregate({
      where: {
        categoryId: charityCategory.id,
        account: { accountType: AccountType.EXPENSE },
        journalEntry: { userId, transactionDate: { gte: trailingStart, lt: start } }
      },
      _sum: { amount: true }
    })

    const current = toNumber(charityCurrent._sum.amount)
    const average = toNumber(trailing._sum.amount) / 3
    if (average > 0 && current < average) {
      alerts.push({ type: 'info', message: 'Charity contributions are below your recent average.' })
    }
  }

  const overdueLoanCount = await prisma.lendingRecord.count({
      where: {
      userId,
      kind: LendingKind.LOAN,
      status: LendingStatus.OPEN,
      currentBalance: { gt: new Prisma.Decimal(0) }
    }
  })
  if (overdueLoanCount > 0) {
    alerts.push({ type: 'warning', message: `${overdueLoanCount} loan(s) are overdue by more than 30 days.` })
  }

  if (alerts.length === 0 && income > expense) {
    alerts.push({ type: 'success', message: 'You are cashflow positive for this month.' })
  }

  return alerts.slice(0, 3)
}

export async function getMonthlyPrediction(
  userId: string,
  month: number,
  year: number
): Promise<PredictionResponse> {
  const now = new Date()
  const selectedCurrentMonth = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month
  const start = startOfMonth(year, month)
  const end = endOfMonth(year, month)
  const predictionReference = selectedCurrentMonth ? now : end

  const expenseAgg = await prisma.journalLine.aggregate({
    where: {
      account: { accountType: AccountType.EXPENSE },
      journalEntry: {
        userId,
        transactionDate: { gte: start, lte: selectedCurrentMonth ? now : end }
      }
    },
    _sum: { amount: true }
  })

  const elapsedDays = selectedCurrentMonth ? Math.max(now.getUTCDate(), 1) : end.getUTCDate()
  const avgDailyExpense = toNumber(expenseAgg._sum?.amount) / elapsedDays
  const daysRemaining = selectedCurrentMonth ? end.getUTCDate() - now.getUTCDate() : 0

  const balances = await getAccountBalancesByType(userId, predictionReference)
  const currentBalance = balances.asset - balances.liability

  return {
    projectedBalance: currentBalance - avgDailyExpense * daysRemaining
  }
}


type DashboardSummaryResponse = {
  requestId: string
  timestamp: string
  month: number
  year: number
  balances: { netWorth: number; savingsThisMonth: number; assets: number; liabilities: number }
  metrics: { income: number; expense: number; cashflow: number }
  todaySummary: { income: number; expense: number }
  bills: unknown[]
  transactions: unknown[]
  budgets: unknown[]
  analytics: Array<{ month: string; income: number; expense: number }>
  insights: { financialHealth: FinancialHealthResponse; prediction: PredictionResponse; alerts: DashboardAlert[] }
  ledgerCategoriesState: { total: number }
}

export async function getDashboardSummary(userId: string, month: number, year: number, requestId = crypto.randomUUID()): Promise<DashboardSummaryResponse> {
  const [incomeExpense, netWorth, expenseBreakdown, alerts, prediction, lendingSummary, financialHealth, categoriesCount] = await Promise.all([
    getMonthlyIncomeExpense(userId, month, year),
    getNetWorthSummary(userId, month, year),
    getExpenseBreakdown(userId, month, year),
    generateDashboardAlerts(userId, month, year),
    getMonthlyPrediction(userId, month, year),
    getLendingSummary(userId, month, year),
    calculateFinancialHealth(userId, month, year),
    prisma.category.count({ where: { userId } })
  ])

  const now = new Date()
  const [todayIncomeAgg, todayExpenseAgg] = await Promise.all([
    prisma.journalLine.aggregate({
      where: { journalEntry: { userId, transactionDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)), lte: now } }, account: { accountType: AccountType.INCOME } },
      _sum: { amount: true }
    }),
    prisma.journalLine.aggregate({
      where: { journalEntry: { userId, transactionDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)), lte: now } }, account: { accountType: AccountType.EXPENSE } },
      _sum: { amount: true }
    })
  ])

  const analytics = await Promise.all(Array.from({ length: 6 }).map(async (_, idx) => {
    const d = new Date(Date.UTC(year, month - 1 - idx, 1))
    const values = await getMonthlyIncomeExpense(userId, d.getUTCMonth() + 1, d.getUTCFullYear())
    return { month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, income: values.income, expense: values.expense }
  }))

  return {
    requestId,
    timestamp: new Date().toISOString(),
    month,
    year,
    balances: { ...netWorth, assets: netWorth.netWorth + lendingSummary.totalLent, liabilities: lendingSummary.totalLoan },
    metrics: { income: incomeExpense.income, expense: incomeExpense.expense, cashflow: incomeExpense.income - incomeExpense.expense },
    todaySummary: { income: toNumber(todayIncomeAgg._sum.amount), expense: toNumber(todayExpenseAgg._sum.amount) },
    bills: [],
    transactions: expenseBreakdown,
    budgets: [],
    analytics: analytics.reverse(),
    insights: { financialHealth, prediction, alerts },
    ledgerCategoriesState: { total: categoriesCount }
  }
}
