import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { createAuthToken } from '../lib/token.js'
import { requestContext } from '../middleware/request-context.middleware.js'
import { createDashboardRouter } from '../routes/dashboard.routes.js'

function createServer(summaryPayload: unknown) {
  const app = express()
  app.use(requestContext)
  app.use('/api/dashboard', createDashboardRouter({
    getDashboardSummary: async () => summaryPayload as never,
    calculateFinancialHealth: async () => ({ score: 0, label: 'Risky' as const }),
    getNetWorthSummary: async () => ({ netWorth: 0, savingsThisMonth: 0 }),
    getExpenseBreakdown: async () => [],
    generateDashboardAlerts: async () => [],
    getMonthlyPrediction: async () => ({ projectedBalance: 0 }),
    getLendingSummary: async () => ({ totalLent: 0, totalLoan: 0, breakdown: [], agingBuckets: [] })
  }))

  return new Promise<import('node:http').Server>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('dashboard summary requires auth', async () => {
  const server = await createServer({})
  const port = (server.address() as any).port
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary?month=2026-01`)
  assert.equal(response.status, 401)
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

test('dashboard summary returns zero safe payload for empty month', async () => {
  const emptyPayload = {
    userName: 'Demo',
    profilePhoto: '',
    monthLabel: 'January 2026',
    balance: 0,
    income: 0,
    expense: 0,
    metricCards: [],
    todaySummary: { dateLabel: 'Mon', income: 0, expense: 0, cardTotals: [] },
    budgetSummary: { monthly: 0, yearly: 0 },
    jobs: [], shortcuts: [], activity: [], bills: [], transactions: [], budgets: [], analytics: [],
    insights: {
      financialHealth: { score: 0, label: 'Risky' },
      netWorth: { netWorth: 0, savingsThisMonth: 0 },
      expenseBreakdown: [],
      alerts: [],
      prediction: { projectedBalance: 0 },
      lendingSummary: { totalLent: 0, totalLoan: 0, breakdown: [], agingBuckets: [] }
    },
    ledgerCategoriesState: { message: null, retryable: false }
  }

  const server = await createServer(emptyPayload)
  const port = (server.address() as any).port
  const token = createAuthToken('test-user-id')
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary?month=2026-01`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.balance, 0)
  assert.deepEqual(body.data.analytics, [])
  assert.ok(body.requestId)
  assert.ok(body.timestamp)

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

test('dashboard summary returns populated payload for normal month', async () => {
  const server = await createServer({
    userName: 'Demo',
    profilePhoto: '',
    monthLabel: 'January 2026',
    balance: 1300,
    income: 5000,
    expense: 3700,
    metricCards: [{ id: 'charity', name: 'Charity', amount: 500, href: '/dashboard' }],
    todaySummary: { dateLabel: 'Mon', income: 100, expense: 50, cardTotals: [] },
    budgetSummary: { monthly: 4000, yearly: 48000 },
    jobs: [], shortcuts: [], activity: [], bills: [], transactions: [], budgets: [],
    analytics: [{ name: '2026-01', income: 5000, expense: 3700 }],
    insights: {
      financialHealth: { score: 75, label: 'Good' },
      netWorth: { netWorth: 1300, savingsThisMonth: 1300 },
      expenseBreakdown: [{ category: 'Food', amount: 1400 }],
      alerts: [],
      prediction: { projectedBalance: 1300 },
      lendingSummary: { totalLent: 800, totalLoan: 2100, breakdown: [], agingBuckets: [] }
    },
    ledgerCategoriesState: { message: null, retryable: false }
  })
  const port = (server.address() as any).port
  const token = createAuthToken('test-user-id')
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary?month=2026-01`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.income, 5000)
  assert.equal(body.data.metricCards[0].name, 'Charity')

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})
