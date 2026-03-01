import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.middleware.js'

export const budgetsRouter = Router()

const createBudgetSchema = z.object({ name: z.string().trim().min(1).max(120) })

budgetsRouter.use(requireAuth)

budgetsRouter.get('/', async (req, res) => {
  const userId = req.authUserId!
  const budgets = await prisma.budgetPlan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: budgets.map((b) => ({ id: b.id, name: b.name })) })
})

budgetsRouter.post('/', async (req, res) => {
  const parsed = createBudgetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ requestId: req.requestId, timestamp: new Date().toISOString(), errors: parsed.error.flatten().fieldErrors })
  const budget = await prisma.budgetPlan.create({ data: { userId: req.authUserId!, name: parsed.data.name } })
  return res.status(201).json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: { id: budget.id, name: budget.name } })
})

budgetsRouter.patch('/:id', async (req, res) => {
  const parsed = createBudgetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ requestId: req.requestId, timestamp: new Date().toISOString(), errors: parsed.error.flatten().fieldErrors })
  const existing = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, userId: req.authUserId! } })
  if (!existing) return res.status(404).json({ requestId: req.requestId, timestamp: new Date().toISOString(), error: 'NOT_FOUND' })
  const budget = await prisma.budgetPlan.update({ where: { id: existing.id }, data: { name: parsed.data.name } })
  return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: { id: budget.id, name: budget.name } })
})

budgetsRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.budgetPlan.findFirst({ where: { id: req.params.id, userId: req.authUserId! } })
  if (!existing) return res.status(404).json({ requestId: req.requestId, timestamp: new Date().toISOString(), error: 'NOT_FOUND' })
  await prisma.budgetPlan.delete({ where: { id: existing.id } })
  return res.status(204).send()
})
