import { Router } from 'express'
import { z } from 'zod'
import { sendError } from '../lib/api-response.js'
import { requireAuthWithPin } from '../middleware/auth.middleware.js'
import {
  calculateFinancialHealth,
  generateDashboardAlerts,
  getDashboardSummary,
  getExpenseBreakdown,
  getLendingSummary,
  getMonthlyPrediction,
  getNetWorthSummary
} from '../services/dashboard/dashboard.service.js'

const summaryQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
const monthYearSchema = z.object({ month: z.string().regex(/^(0[1-9]|1[0-2]|[1-9])$/), year: z.string().regex(/^\d{4}$/) })

const cache = 'private, max-age=60, stale-while-revalidate=120'

function parseSummaryMonth(query: unknown): { month: number; year: number } | null {
  const parsed = summaryQuerySchema.safeParse(query)
  if (!parsed.success) return null
  const [year, month] = parsed.data.month.split('-').map(Number)
  return { year, month }
}

function parseInsightMonthYear(query: unknown): { month: number; year: number } | null {
  const parsed = monthYearSchema.safeParse(query)
  if (!parsed.success) return null
  return { month: Number(parsed.data.month), year: Number(parsed.data.year) }
}

type DashboardDeps = {
  getDashboardSummary: typeof getDashboardSummary
  calculateFinancialHealth: typeof calculateFinancialHealth
  getNetWorthSummary: typeof getNetWorthSummary
  getExpenseBreakdown: typeof getExpenseBreakdown
  generateDashboardAlerts: typeof generateDashboardAlerts
  getMonthlyPrediction: typeof getMonthlyPrediction
  getLendingSummary: typeof getLendingSummary
}

export function createDashboardRouter(deps: DashboardDeps) {
  const router = Router()
  router.use(requireAuthWithPin)
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', cache)
    next()
  })

  router.get('/summary', async (req, res) => {
    const parsed = parseSummaryMonth(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=YYYY-MM')

    const data = await deps.getDashboardSummary(req.authUserId!, parsed.month, parsed.year)
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data })
  })

  router.get('/financial-health', async (req, res) => {
    const parsed = parseInsightMonthYear(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=MM&year=YYYY')
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: await deps.calculateFinancialHealth(req.authUserId!, parsed.month, parsed.year) })
  })

  router.get('/net-worth', async (req, res) => {
    const parsed = parseInsightMonthYear(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=MM&year=YYYY')
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: await deps.getNetWorthSummary(req.authUserId!, parsed.month, parsed.year) })
  })

  router.get('/expense-breakdown', async (req, res) => {
    const parsed = parseInsightMonthYear(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=MM&year=YYYY')
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: await deps.getExpenseBreakdown(req.authUserId!, parsed.month, parsed.year) })
  })

  router.get('/alerts', async (req, res) => {
    const parsed = parseInsightMonthYear(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=MM&year=YYYY')
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: await deps.generateDashboardAlerts(req.authUserId!, parsed.month, parsed.year) })
  })

  router.get('/prediction', async (req, res) => {
    const parsed = parseInsightMonthYear(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=MM&year=YYYY')
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: await deps.getMonthlyPrediction(req.authUserId!, parsed.month, parsed.year) })
  })

  router.get('/lending-summary', async (req, res) => {
    const parsed = parseInsightMonthYear(req.query)
    if (!parsed) return sendError(res, 422, 'INVALID_INPUT', 'Expected month=MM&year=YYYY')
    return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: await deps.getLendingSummary(req.authUserId!) })
  })

  return router
}

export const dashboardRouter = createDashboardRouter({
  getDashboardSummary,
  calculateFinancialHealth,
  getNetWorthSummary,
  getExpenseBreakdown,
  generateDashboardAlerts,
  getMonthlyPrediction,
  getLendingSummary
})
