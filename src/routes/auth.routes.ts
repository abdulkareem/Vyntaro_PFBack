import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { normalizePhone, phoneSchema } from '../lib/phone.js'
import {
  checkIdentity,
  login,
  registerStart,
  resetPinComplete,
  resetPinStartByIdentity,
  setUserPin,
  verifyRegistrationOtp,
  verifyResetPinOtp
} from '../services/auth.service.js'

export const authRouter = Router()

const identityBaseSchema = z.object({
  phone: phoneSchema.optional(),
  email: z.string().email().optional()
})

const identitySchema = identityBaseSchema.refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
})

const registerSchema = identityBaseSchema.extend({
  country: z.string().optional(),
  region: z.string().optional()
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
})

const pinSchema = z.object({
  phone: phoneSchema,
  pin: z.string().min(4).max(8)
})

const resetPinStartSchema = identityBaseSchema.extend({
  country: z.string().optional(),
  region: z.string().optional()
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
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
  if (reason === 'invalid_input') return 400
  if (reason === 'user_exists') return 409
  if (reason === 'not_verified') return 403
  return 400
}

function normalizeSuccess(message: string, next: string, extras?: Record<string, unknown>) {
  return {
    success: true as const,
    message,
    next,
    ...(extras ?? {})
  }
}

function normalizeError(code: string, message: string, extras?: Record<string, unknown>) {
  return {
    success: false as const,
    code,
    message,
    ...(extras ?? {})
  }
}

const identityCheckHandler = asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(normalizeError('INVALID_INPUT', 'Provide a valid phone or email', { details: parsed.error.flatten() }))
  }

  const result = await checkIdentity({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email
  })

  if (!result.ok) {
    return res.status(400).json(normalizeError('INVALID_INPUT', 'Provide a valid phone or email'))
  }

  return res.json({ exists: result.exists, via: result.via })
})

const registerStartHandler = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(normalizeError('INVALID_INPUT', 'Invalid registration payload', { details: parsed.error.flatten() }))
  }

  const result = await registerStart({
    ...parsed.data,
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined
  })

  if (!result.ok) {
    const status = statusForReason(result.reason)
    if (result.reason === 'user_exists') {
      return res.status(status).json(normalizeError('USER_EXISTS', 'User already exists', { field: result.field }))
    }

    return res.status(status).json(normalizeError('INVALID_INPUT', 'Invalid registration identity'))
  }

  const nextStep = result.next === '/verify-otp' ? 'verify-otp' : result.next === '/login' ? 'login' : 'set-pin'
  const message = result.next === '/verify-otp' ? 'Registration started. OTP sent.' : 'User already registered.'

  return res.json(normalizeSuccess(message, nextStep, {
    delivery: result.delivery,
    user: result.user,
    devOtp: result.devOtp
  }))
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
    return res.status(400).json(normalizeError('INVALID_INPUT', 'Invalid reset payload', { details: parsed.error.flatten() }))
  }

  const result = await resetPinStartByIdentity({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email
  })
  if (!result.ok) {
    const status = statusForReason(result.reason)
    if (result.reason === 'not_found') {
      return res.status(status).json(normalizeError('USER_NOT_FOUND', 'No active user found for the provided identity'))
    }

    return res.status(status).json(normalizeError('INVALID_INPUT', 'Invalid reset identity'))
  }

  return res.json(normalizeSuccess('PIN reset OTP sent.', 'verify-otp', { delivery: result.delivery, devOtp: result.devOtp }))
})

const resetPinVerifyHandler = asyncHandler(async (req, res) => {
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(normalizeError('INVALID_INPUT', 'Invalid OTP verification payload', { details: parsed.error.flatten() }))
  }

  const result = await verifyResetPinOtp(normalizePhone(parsed.data.phone), parsed.data.otp)
  if (!result.ok) {
    const status = statusForReason(result.reason)
    if (result.reason === 'not_found') {
      return res.status(status).json(normalizeError('USER_NOT_FOUND', 'No active user found for the provided identity'))
    }

    if (result.reason === 'otp_expired') {
      return res.status(status).json(normalizeError('OTP_EXPIRED', 'OTP has expired'))
    }

    if (result.reason === 'otp_attempt_limit_reached') {
      return res.status(status).json(normalizeError('OTP_ATTEMPTS_EXCEEDED', 'Too many invalid OTP attempts'))
    }

    return res.status(status).json(normalizeError('INVALID_OTP', 'Invalid OTP'))
  }

  return res.json(normalizeSuccess('OTP verified.', 'complete-pin-reset'))
})

const resetPinCompleteHandler = asyncHandler(async (req, res) => {
  const parsed = resetPinCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(normalizeError('INVALID_INPUT', 'Invalid PIN reset completion payload', { details: parsed.error.flatten() }))
  }

  const result = await resetPinComplete(normalizePhone(parsed.data.phone), parsed.data.otp, parsed.data.pin)
  if (!result.ok) {
    const status = statusForReason(result.reason)
    if (result.reason === 'not_verified') {
      return res.status(404).json(normalizeError('USER_NOT_FOUND', 'No active user found for the provided identity'))
    }

    if (result.reason === 'otp_expired') {
      return res.status(status).json(normalizeError('OTP_EXPIRED', 'OTP has expired'))
    }

    if (result.reason === 'otp_attempt_limit_reached') {
      return res.status(status).json(normalizeError('OTP_ATTEMPTS_EXCEEDED', 'Too many invalid OTP attempts'))
    }

    return res.status(status).json(normalizeError('INVALID_OTP', 'Invalid OTP'))
  }

  return res.json(normalizeSuccess('PIN reset complete.', 'login'))
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
authRouter.post('/pin/reset/start', resetPinStartHandler)
authRouter.post('/pin/reset/verify', resetPinVerifyHandler)
authRouter.post('/forgot-pin/start', resetPinStartHandler)
authRouter.post('/forgot-password/start', resetPinStartHandler)

authRouter.post('/reset-pin/complete', resetPinCompleteHandler)
authRouter.post('/pin/reset/complete', resetPinCompleteHandler)
authRouter.post('/forgot-pin/complete', resetPinCompleteHandler)
authRouter.post('/forgot-password/complete', resetPinCompleteHandler)
