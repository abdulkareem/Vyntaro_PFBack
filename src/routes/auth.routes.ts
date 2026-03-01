import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { normalizePhone, phoneSchema } from '../lib/phone.js'
import {
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

const resetPinCompleteSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6),
  pin: z.string().min(4).max(8)
})

const verifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6)
})

const parseError = (error: z.ZodError) => ({ error: error.flatten() })

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
  if (reason === 'OTP expired') return 410
  if (reason === 'Too many attempts') return 429
  if (reason === 'Invalid OTP') return 400
  if (reason === 'not_verified') return 403
  return 400
}

authRouter.post(
  '/register/start',
  asyncHandler(async (req, res) => {
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
)

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
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
)

authRouter.post(
  '/register/verify',
  asyncHandler(async (req, res) => {
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
)

authRouter.post(
  '/pin/set',
  asyncHandler(async (req, res) => {
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
)

authRouter.post(
  '/set-pin',
  asyncHandler(async (req, res) => {
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
)

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
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
)

authRouter.post(
  '/reset-pin/start',
  asyncHandler(async (req, res) => {
    const schema = z.object({ phone: phoneSchema })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json(parseError(parsed.error))
    }

    const result = await resetPinStart(normalizePhone(parsed.data.phone))
    if (!result.ok) {
      return res.status(statusForReason(result.reason)).json(result)
    }

    return res.json(result)
  })
)

authRouter.post(
  '/reset-pin/complete',
  asyncHandler(async (req, res) => {
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
)
