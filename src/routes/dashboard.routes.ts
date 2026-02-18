import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  calculateFinancialHealth,
  generateDashboardAlerts,
  getExpenseBreakdown,
  getLendingSummary,
  getMonthlyPrediction,
  getNetWorthSummary
} from '../services/dashboard/dashboard.service.js'

export const dashboardRouter = Router()

dashboardRouter.use(requireAuth)

const querySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2200)
})

function parseMonthYear(query: unknown) {
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  return { data: parsed.data }
}

dashboardRouter.get('/financial-health', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await calculateFinancialHealth(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})

dashboardRouter.get('/health-score', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await calculateFinancialHealth(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})

dashboardRouter.get('/net-worth', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await getNetWorthSummary(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})

dashboardRouter.get('/expense-breakdown', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await getExpenseBreakdown(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})

dashboardRouter.get('/alerts', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await generateDashboardAlerts(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})

dashboardRouter.get('/prediction', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await getMonthlyPrediction(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})

dashboardRouter.get('/lending-summary', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const response = await getLendingSummary(req.authUserId!, parsed.data.month, parsed.data.year)
  return res.json(response)
})
