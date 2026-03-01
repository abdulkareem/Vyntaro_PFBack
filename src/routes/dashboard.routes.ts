import { Router } from 'express'
import { z } from 'zod'
import { sendError } from '../lib/api-response.js'
import { requireAuthWithPin } from '../middleware/auth.middleware.js'
import { calculateFinancialHealth, generateDashboardAlerts, getExpenseBreakdown, getLendingSummary, getMonthlyPrediction, getNetWorthSummary } from '../services/dashboard/dashboard.service.js'

export const dashboardRouter = Router()

dashboardRouter.use(requireAuthWithPin)

const querySchema = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2000).max(2200) })
const cache = 'private, max-age=60, stale-while-revalidate=120'

function parseMonthYear(query: unknown) {
  const parsed = querySchema.safeParse(query)
  return parsed.success ? parsed.data : null
}

dashboardRouter.use((_req, res, next) => { res.setHeader('Cache-Control', cache); next() })

dashboardRouter.get('/financial-health', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if (!parsed) return sendError(res, 400, 'INVALID_INPUT', 'Invalid month/year query')
  try { return res.json(await calculateFinancialHealth(req.authUserId!, parsed.month, parsed.year)) }
  catch { return res.json({ score: 0, label: 'Risky' }) }
})

dashboardRouter.get('/net-worth', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if (!parsed) return sendError(res, 400, 'INVALID_INPUT', 'Invalid month/year query')
  try { return res.json(await getNetWorthSummary(req.authUserId!, parsed.month, parsed.year)) }
  catch { return res.json({ netWorth: 0, savingsThisMonth: 0 }) }
})

dashboardRouter.get('/expense-breakdown', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if (!parsed) return sendError(res, 400, 'INVALID_INPUT', 'Invalid month/year query')
  try { return res.json(await getExpenseBreakdown(req.authUserId!, parsed.month, parsed.year)) }
  catch { return res.json([]) }
})

dashboardRouter.get('/alerts', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if (!parsed) return sendError(res, 400, 'INVALID_INPUT', 'Invalid month/year query')
  try { return res.json(await generateDashboardAlerts(req.authUserId!, parsed.month, parsed.year)) }
  catch { return res.json([]) }
})

dashboardRouter.get('/prediction', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if (!parsed) return sendError(res, 400, 'INVALID_INPUT', 'Invalid month/year query')
  try { return res.json(await getMonthlyPrediction(req.authUserId!, parsed.month, parsed.year)) }
  catch { return res.json({ projectedBalance: 0 }) }
})

dashboardRouter.get('/lending-summary', async (req, res) => {
  const parsed = parseMonthYear(req.query)
  if (!parsed) return sendError(res, 400, 'INVALID_INPUT', 'Invalid month/year query')
  try { return res.json(await getLendingSummary(req.authUserId!, parsed.month, parsed.year)) }
  catch { return res.json({ totalLent: 0, totalLoan: 0, breakdown: [], agingBuckets: [] }) }
})
