import { AccountType, CategoryKind, LendingKind, LendingStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export function toNumber(value: Prisma.Decimal | null | undefined): number {
  return Number(value ?? 0)
}

export function getMonthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  }
}

export async function getUserHeader(userId: string) {
  return prisma.userAccount.findUnique({
    where: { id: userId },
    select: { phone: true, email: true }
  })
}

export async function getMonthlyIncomeExpenseRaw(userId: string, year: number, month: number) {
  const { start, end } = getMonthRange(year, month)
  const grouped = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { journalEntry: { userId, transactionDate: { gte: start, lte: end } } },
    _sum: { amount: true }
  })

  if (grouped.length === 0) return { income: 0, expense: 0 }

  const accounts = await prisma.financialAccount.findMany({
    where: { id: { in: grouped.map((item) => item.accountId) } },
    select: { id: true, accountType: true }
  })

  const byId = new Map(accounts.map((account) => [account.id, account.accountType]))

  return grouped.reduce(
    (acc, item) => {
      const type = byId.get(item.accountId)
      const amount = toNumber(item._sum.amount)
      if (type === AccountType.INCOME) acc.income += amount
      if (type === AccountType.EXPENSE) acc.expense += amount
      return acc
    },
    { income: 0, expense: 0 }
  )
}

export async function getExpenseBreakdownRaw(userId: string, year: number, month: number) {
  const { start, end } = getMonthRange(year, month)
  const grouped = await prisma.journalLine.groupBy({
    by: ['categoryId'],
    where: {
      journalEntry: { userId, transactionDate: { gte: start, lte: end } },
      account: { accountType: AccountType.EXPENSE },
      categoryId: { not: null }
    },
    _sum: { amount: true }
  })

  const categoryIds = grouped.map((row) => row.categoryId).filter((row): row is string => Boolean(row))
  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : []

  const nameById = new Map(categories.map((row) => [row.id, row.name]))
  return grouped
    .map((row) => ({ category: nameById.get(row.categoryId ?? '') ?? 'Uncategorized', amount: toNumber(row._sum.amount) }))
    .sort((a, b) => b.amount - a.amount)
}

export async function getDashboardCardCategoryMap(userId: string) {
  const categories = await prisma.category.findMany({
    where: {
      userId,
      OR: [{ showOnDashboard: true }, { bucket: { in: ['CHARITY', 'MONEY_LENT', 'MONEY_BORROWED'] } }]
    },
    select: { id: true, name: true, bucket: true, kind: true, dashboardOrder: true },
    orderBy: [{ dashboardOrder: 'asc' }, { name: 'asc' }]
  })
  return categories
}

export async function getCategoryMonthlyTotals(userId: string, year: number, month: number, categoryIds: string[]) {
  if (categoryIds.length === 0) return []
  const { start, end } = getMonthRange(year, month)
  return prisma.journalLine.groupBy({
    by: ['categoryId'],
    where: { categoryId: { in: categoryIds }, journalEntry: { userId, transactionDate: { gte: start, lte: end } } },
    _sum: { amount: true }
  })
}

export async function getMonthlyTrend(userId: string, year: number, month: number, points = 6) {
  const months = Array.from({ length: points }).map((_, idx) => {
    const date = new Date(Date.UTC(year, month - 1 - (points - 1 - idx), 1))
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, label: date.toISOString().slice(0, 7) }
  })

  const results = await Promise.all(months.map((entry) => getMonthlyIncomeExpenseRaw(userId, entry.year, entry.month)))
  return months.map((entry, idx) => ({ name: entry.label, income: results[idx].income, expense: results[idx].expense }))
}

export async function getTodayIncomeExpense(userId: string) {
  const now = new Date()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.journalLine.aggregate({
      where: { journalEntry: { userId, transactionDate: { gte: dayStart, lte: now } }, account: { accountType: AccountType.INCOME } },
      _sum: { amount: true }
    }),
    prisma.journalLine.aggregate({
      where: { journalEntry: { userId, transactionDate: { gte: dayStart, lte: now } }, account: { accountType: AccountType.EXPENSE } },
      _sum: { amount: true }
    })
  ])

  return { income: toNumber(incomeAgg._sum.amount), expense: toNumber(expenseAgg._sum.amount) }
}

export async function getLendingRecords(userId: string) {
  return prisma.lendingRecord.findMany({
    where: { userId, status: { in: [LendingStatus.OPEN, LendingStatus.WRITTEN_OFF] } },
    select: { person: true, kind: true, currentBalance: true },
    orderBy: { person: 'asc' }
  })
}

export async function getBudgetPlans(userId: string) {
  return prisma.budgetPlan.findMany({
    where: { userId },
    select: { id: true, name: true, monthlyLimit: true, yearlyLimit: true }
  })
}

export async function getUserCategoriesCount(userId: string) {
  return prisma.category.count({ where: { userId } })
}

export async function getRecentTransactions(userId: string, year: number, month: number, limit = 10) {
  const { start, end } = getMonthRange(year, month)
  const entries = await prisma.journalEntry.findMany({
    where: { userId, transactionDate: { gte: start, lte: end } },
    orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      transactionDate: true,
      description: true,
      lines: {
        where: { categoryId: { not: null }, account: { accountType: { in: [AccountType.INCOME, AccountType.EXPENSE] } } },
        select: { amount: true, account: { select: { accountType: true } }, category: { select: { name: true } } }
      }
    }
  })

  return entries.map((entry) => {
    const line = entry.lines[0]
    return {
      id: entry.id,
      date: entry.transactionDate.toISOString(),
      description: entry.description ?? '',
      category: line?.category?.name ?? 'Uncategorized',
      type: line?.account.accountType === AccountType.INCOME ? 'income' : 'expense',
      amount: toNumber(line?.amount)
    }
  })
}
