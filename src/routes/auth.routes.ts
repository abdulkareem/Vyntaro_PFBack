import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { normalizePhone, phoneSchema } from '../lib/phone.js'
import {
  checkIdentity,
  login,
  registerStart,
  resetPinComplete,
  resetPinStart,
  setUserPin,
  verifyRegistrationOtp
} from '../services/auth.service.js'

export const authRouter = Router()

const registerSchema = z.object({
  phone: phoneSchema,
  email: z.string().email().optional(),
  country: z.string().optional(),
  region: z.string().optional()
})

const pinSchema = z.object({
  phone: phoneSchema,
  pin: z.string().min(4).max(8)
})

const resetPinStartSchema = z.object({ phone: phoneSchema })

const resetPinCompleteSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6),
  pin: z.string().min(4).max(8)
})

const verifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6)
})

const parseError = (error: z.ZodError) => ({ ok: false as const, error: error.flatten() })

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

function statusForReason(reason?: string): number {
  if (!reason) return 400
  if (reason === 'pin_not_set') return 403
  if (reason === 'invalid_credentials') return 401
  if (reason === 'not_found') return 404
  if (reason === 'otp_expired') return 410
  if (reason === 'otp_attempt_limit_reached') return 429
  if (reason === 'invalid_otp') return 400
  if (reason === 'not_verified') return 403
  return 400
}

const identityCheckHandler = asyncHandler(async (req, res) => {
  const parsed = resetPinStartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await checkIdentity(normalizePhone(parsed.data.phone))
  return res.json(result)
})

const registerStartHandler = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await registerStart({
    ...parsed.data,
    phone: normalizePhone(parsed.data.phone)
  })

  return res.json(result)
})

const otpVerifyHandler = asyncHandler(async (req, res) => {
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await verifyRegistrationOtp(normalizePhone(parsed.data.phone), parsed.data.otp)
  if (!result.ok) {
    return res.status(statusForReason(result.reason)).json(result)
  }

  return res.json(result)
})

const setPinHandler = asyncHandler(async (req, res) => {
  const parsed = pinSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await setUserPin(normalizePhone(parsed.data.phone), parsed.data.pin)
  if (!result.ok) {
    return res.status(statusForReason(result.reason)).json(result)
  }

  return res.json(result)
})

const loginHandler = asyncHandler(async (req, res) => {
  const parsed = pinSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await login(normalizePhone(parsed.data.phone), parsed.data.pin)
  if (!result.ok) {
    return res.status(statusForReason(result.reason)).json(result)
  }

  return res.json(result)
})

const resetPinStartHandler = asyncHandler(async (req, res) => {
  const parsed = resetPinStartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await resetPinStart(normalizePhone(parsed.data.phone))
  if (!result.ok) {
    return res.status(statusForReason(result.reason)).json(result)
  }

  return res.json(result)
})

const resetPinCompleteHandler = asyncHandler(async (req, res) => {
  const parsed = resetPinCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(parseError(parsed.error))
  }

  const result = await resetPinComplete(normalizePhone(parsed.data.phone), parsed.data.otp, parsed.data.pin)
  if (!result.ok) {
    return res.status(statusForReason(result.reason)).json(result)
  }

  return res.json(result)
})

authRouter.post('/identity/check', identityCheckHandler)

authRouter.post('/register/start', registerStartHandler)
authRouter.post('/register', registerStartHandler)
authRouter.post('/otp/send', registerStartHandler)

authRouter.post('/register/verify', otpVerifyHandler)
authRouter.post('/otp/verify', otpVerifyHandler)

authRouter.post('/pin/set', setPinHandler)
authRouter.post('/set-pin', setPinHandler)

authRouter.post('/login', loginHandler)

authRouter.post('/reset-pin/start', resetPinStartHandler)
authRouter.post('/forgot-pin/start', resetPinStartHandler)
authRouter.post('/forgot-password/start', resetPinStartHandler)

authRouter.post('/reset-pin/complete', resetPinCompleteHandler)
authRouter.post('/forgot-pin/complete', resetPinCompleteHandler)
authRouter.post('/forgot-password/complete', resetPinCompleteHandler)
