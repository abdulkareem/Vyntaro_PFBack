import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { normalizePhone, phoneSchema } from '../lib/phone.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { otpRequest, otpVerify } from '../services/auth.service.js'

export const profileRouter = Router()

profileRouter.use(requireAuth)

const patchSchema = z.object({ email: z.string().email().optional(), mobile: phoneSchema.optional(), avatarUrl: z.string().url().optional(), currency: z.string().length(3).optional(), timezone: z.string().min(1).max(80).optional(), name: z.string().min(1).max(120).optional() })
const otpSchema = z.object({ phone: phoneSchema.optional(), email: z.string().email().optional() })
const otpVerifySchema = otpSchema.extend({ otp: z.string().length(6) })

profileRouter.get('/me', async (req, res) => {
  const user = await prisma.userAccount.findUnique({ where: { id: req.authUserId! }, select: { id: true, email: true, phone: true, createdAt: true, updatedAt: true } })
  if (!user) return res.status(404).json({ requestId: req.requestId, timestamp: new Date().toISOString(), error: 'NOT_FOUND' })
  return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: { id: user.id, name: user.email ?? user.phone, email: user.email, mobile: user.phone, avatarUrl: null, currency: 'INR', timezone: 'UTC', createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() } })
})

profileRouter.patch('/me', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ requestId: req.requestId, timestamp: new Date().toISOString(), errors: parsed.error.flatten().fieldErrors })
  const user = await prisma.userAccount.update({ where: { id: req.authUserId! }, data: { email: parsed.data.email?.toLowerCase(), phone: parsed.data.mobile ? normalizePhone(parsed.data.mobile) : undefined } })
  return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: { id: user.id, name: user.email ?? user.phone, email: user.email, mobile: user.phone, avatarUrl: parsed.data.avatarUrl ?? null, currency: parsed.data.currency ?? 'INR', timezone: parsed.data.timezone ?? 'UTC', updatedAt: user.updatedAt.toISOString() } })
})

profileRouter.post('/otp/request', async (req, res) => {
  const parsed = otpSchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ requestId: req.requestId, timestamp: new Date().toISOString(), errors: parsed.error.flatten().fieldErrors })
  const result = await otpRequest({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email })
  if (!result.ok) return res.status(400).json({ requestId: req.requestId, timestamp: new Date().toISOString(), error: result.code, message: result.message })
  return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: result })
})

profileRouter.post('/otp/verify', async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ requestId: req.requestId, timestamp: new Date().toISOString(), errors: parsed.error.flatten().fieldErrors })
  const result = await otpVerify({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email, otp: parsed.data.otp })
  if (!result.ok) return res.status(400).json({ requestId: req.requestId, timestamp: new Date().toISOString(), error: result.code, message: result.message })
  return res.json({ requestId: req.requestId, timestamp: new Date().toISOString(), data: result })
})
