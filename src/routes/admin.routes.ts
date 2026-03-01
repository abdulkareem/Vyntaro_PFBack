import { Router } from 'express'
import { z } from 'zod'
import { sendError, sendOk } from '../lib/api-response.js'
import { createAuthToken } from '../lib/token.js'
import { requireAdmin } from '../middleware/auth.middleware.js'
import { logSecurityEvent } from '../middleware/request-context.middleware.js'
import { prisma } from '../lib/prisma.js'
import { comparePin } from '../lib/security.js'

export const adminRouter = Router()

adminRouter.post('/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), pin: z.string() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid admin login payload')

  const user = await prisma.userAccount.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid admin credentials')
  }

  const pin = await prisma.userPin.findUnique({ where: { userId: user.id } })
  if (!pin || !(await comparePin(parsed.data.pin, pin.pinHash))) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid admin credentials')
  }

  logSecurityEvent('admin_login_success', req, { adminId: user.id })
  return sendOk(res, { token: createAuthToken(user.id, true, user.role), profile: { name: user.email ?? user.phone, role: user.role } })
})

adminRouter.use(requireAdmin)

adminRouter.get('/users', async (_req, res) => {
  const users = await prisma.userAccount.findMany({ take: 200, orderBy: { createdAt: 'desc' } })
  return sendOk(res, { data: users })
})

adminRouter.patch('/users/:userId', async (req, res) => {
  const schema = z.object({ role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(), accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid user update payload')
  const user = await prisma.userAccount.update({ where: { id: req.params.userId }, data: parsed.data })
  return sendOk(res, { data: user })
})

adminRouter.patch('/users/:userId/reset-pin', async (req, res) => {
  await prisma.userPin.deleteMany({ where: { userId: req.params.userId } })
  await prisma.userAccount.update({ where: { id: req.params.userId }, data: { pinSet: false } })
  return sendOk(res, { data: { userId: req.params.userId, pinReset: true } })
})

adminRouter.delete('/users/:userId', async (req, res) => {
  await prisma.userAccount.update({ where: { id: req.params.userId }, data: { accountStatus: 'DELETED' } })
  return sendOk(res, { data: { userId: req.params.userId, deleted: true } })
})

adminRouter.get('/tables', async (_req, res) => {
  const [users, journalEntries, lendingRecords] = await Promise.all([
    prisma.userAccount.count(),
    prisma.journalEntry.count(),
    prisma.lendingRecord.count()
  ])
  return sendOk(res, { data: { users, journalEntries, lendingRecords } })
})

adminRouter.put('/settings', async (req, res) => {
  return sendOk(res, { data: { saved: true, settings: req.body ?? {} } })
})
