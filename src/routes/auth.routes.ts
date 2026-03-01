import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { sendError, sendOk } from '../lib/api-response.js'
import { normalizePhone, phoneSchema } from '../lib/phone.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { rateLimit } from '../middleware/rate-limit.middleware.js'
import {
  changePin,
  checkIdentity,
  login,
  otpRequest,
  otpVerify,
  refreshAuth,
  registerStart,
  resetPinStart,
  setUserPin,
  updateProfile,
  verifyRegistrationOtp,
  verifyResetPinOtp,
  type AuthErrorCode
} from '../services/auth.service.js'

export const authRouter = Router()

const identitySchema = z.object({ phone: phoneSchema.optional(), email: z.string().email().optional(), identifier: z.string().optional() })
const otpVerifySchema = identitySchema.extend({ otp: z.string().length(6), purpose: z.enum(['register', 'reset']).optional() })
const setPinSchema = z.object({ pin: z.string(), mode: z.enum(['register', 'reset']), otpSessionId: z.string().min(1).optional() })

const loginSchema = identitySchema.extend({ pin: z.string() })
const refreshSchema = z.object({ refreshToken: z.string().min(1) })
const profileUpdateSchema = z.object({ userId: z.string().min(1), email: z.string().email().optional(), phone: phoneSchema.optional(), avatarUrl: z.string().url().optional(), otpToken: z.string().min(1) })

function asyncHandler(handler: RequestHandler): RequestHandler { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next) }

function codeToStatus(code: AuthErrorCode): number {
  if (code === 'INVALID_INPUT' || code === 'INVALID_PIN') return 400
  if (code === 'ACCOUNT_NOT_FOUND' || code === 'USER_NOT_FOUND') return 401
  if (code === 'OTP_SESSION_REQUIRED') return 403
  if (code === 'USER_EXISTS') return 409
  if (code === 'OTP_EXPIRED') return 400
  if (code === 'OTP_LIMIT_EXCEEDED') return 429
  return 400
}

function respondServiceError(res: Parameters<RequestHandler>[1], code: AuthErrorCode, message: string) {
  return sendError(res, codeToStatus(code), code, message)
}

authRouter.post('/login', rateLimit('auth-login', { windowMs: 60_000, max: 10 }), asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid login payload')
  const result = await login({ ...parsed.data, phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Refresh token is required')
  const result = await refreshAuth(parsed.data.refreshToken)
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/identity/check', asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success || (!parsed.data.phone && !parsed.data.email)) return sendError(res, 400, 'INVALID_INPUT', 'Phone is required')
  const result = await checkIdentity({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email })
  return sendOk(res, result)
}))

authRouter.post('/register/start', rateLimit('auth-register-start', { windowMs: 60_000, max: 5 }), asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid registration payload')
  const result = await registerStart({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/register/verify', rateLimit('auth-register-verify', { windowMs: 60_000, max: 8 }), asyncHandler(async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid verification payload')
  const result = await verifyRegistrationOtp({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email, otp: parsed.data.otp })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/otp/request', rateLimit('auth-otp-request', { windowMs: 60_000, max: 5 }), asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid OTP request payload')
  const result = await otpRequest({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/otp/resend', rateLimit('auth-otp-resend', { windowMs: 60_000, max: 5 }), asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid OTP resend payload')
  const result = await otpRequest({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/otp/verify', rateLimit('auth-otp-verify', { windowMs: 60_000, max: 8 }), asyncHandler(async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid OTP verification payload')
  const result = await otpVerify({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email, otp: parsed.data.otp, purpose: parsed.data.purpose })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/pin/set', asyncHandler(async (req, res) => {
  const parsed = setPinSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid PIN set payload')
  const otpSessionId = parsed.data.otpSessionId ?? req.header('x-otp-session-id')
  if (!otpSessionId) return sendError(res, 403, 'OTP_SESSION_REQUIRED', 'OTP session required')
  const result = await setUserPin({ ...parsed.data, otpSessionId })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/pin/set-with-mode', asyncHandler(async (req, res) => {
  const parsed = setPinSchema.safeParse(req.body)
  if (!parsed.success || !parsed.data.otpSessionId) return sendError(res, 400, 'INVALID_INPUT', 'Invalid PIN payload')
  const result = await setUserPin({ ...parsed.data, otpSessionId: parsed.data.otpSessionId })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/pin/reset/start', rateLimit('auth-pin-reset-start', { windowMs: 60_000, max: 5 }), asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid reset start payload')
  const result = await resetPinStart({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/pin/reset/verify', rateLimit('auth-pin-reset-verify', { windowMs: 60_000, max: 8 }), asyncHandler(async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid reset verify payload')
  const result = await verifyResetPinOtp({ phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined, email: parsed.data.email, otp: parsed.data.otp })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/pin/reset/complete', asyncHandler(async (req, res) => {
  const parsed = setPinSchema.safeParse({ ...req.body, mode: 'reset' })
  if (!parsed.success || !parsed.data.otpSessionId) return sendError(res, 400, 'INVALID_INPUT', 'Invalid reset complete payload')
  const result = await setUserPin({ pin: parsed.data.pin, mode: 'reset', otpSessionId: parsed.data.otpSessionId })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/pin/change', requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({ currentPin: z.string(), newPin: z.string() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success || !req.authUserId) return sendError(res, 400, 'INVALID_INPUT', 'Invalid change PIN payload')
  const result = await changePin({ userId: req.authUserId, ...parsed.data })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, result)
}))

authRouter.post('/profile/update', requireAuth, asyncHandler(async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT', 'Invalid profile update payload')
  const result = await updateProfile({ ...parsed.data, phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined })
  if (!result.ok) return respondServiceError(res, result.code, result.message)
  return sendOk(res, { user: result.user })
}))
