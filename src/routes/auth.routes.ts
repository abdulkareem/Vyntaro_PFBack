import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { normalizePhone, phoneSchema } from '../lib/phone.js'
import {
  checkIdentity,
  login,
  registerStart,
  resendOtpByMode,
  resetPinStart,
  setUserPin,
  verifyRegistrationOtp,
  verifyResetPinOtp,
  type AuthErrorCode
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

const registerStartSchema = identityBaseSchema.extend({
  country: z.string().optional()
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
})

const verifyOtpSchema = identityBaseSchema.extend({
  otp: z.string().length(6)
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
})

const setPinSchema = z.object({
  pin: z.string(),
  mode: z.enum(['register', 'reset']),
  otpSessionId: z.string().min(1).optional()
})

const loginSchema = identityBaseSchema.extend({
  pin: z.string()
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
})

const resendOtpSchema = identityBaseSchema.extend({
  mode: z.enum(['register', 'reset'])
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Either phone or email is required',
  path: ['identity']
})

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function errorStatus(code: AuthErrorCode): number {
  if (code === 'USER_EXISTS') return 409
  if (code === 'USER_NOT_FOUND') return 404
  if (code === 'INVALID_PIN' || code === 'OTP_INVALID') return 400
  if (code === 'OTP_EXPIRED') return 410
  if (code === 'OTP_SESSION_REQUIRED') return 403
  if (code === 'OTP_LIMIT_EXCEEDED') return 429
  return 400
}

const identityCheckHandler = asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Provide phone or email' })
  }

  const result = await checkIdentity({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email
  })

  return res.json(result)
})

const registerStartHandler = asyncHandler(async (req, res) => {
  const parsed = registerStartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid registration payload' })
  }

  const result = await registerStart({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email
  })

  if (!result.ok) {
    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({
    success: true,
    next: 'verify-otp',
    userId: result.userId,
    otpSessionId: result.otpSessionId,
    delivery: result.delivery,
    devOtp: result.devOtp
  })
})

const registerOtpVerifyHandler = asyncHandler(async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid OTP payload' })
  }

  const result = await verifyRegistrationOtp({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email,
    otp: parsed.data.otp
  })

  if (!result.ok) {
    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({ success: true, next: 'set-pin', userId: result.userId, otpSessionId: result.otpSessionId })
})

const setPinHandler = asyncHandler(async (req, res) => {
  const parsed = setPinSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid set-pin payload' })
  }

  const otpSessionId = parsed.data.otpSessionId ?? req.header('x-otp-session-id')
  if (!otpSessionId) {
    return res.status(403).json({
      success: false,
      code: 'OTP_SESSION_REQUIRED',
      message: 'OTP verification is required before setting a PIN'
    })
  }

  const result = await setUserPin({ pin: parsed.data.pin, mode: parsed.data.mode, otpSessionId })
  if (!result.ok) {
    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({ success: true, next: 'login' })
})

const loginHandler = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid login payload' })
  }

  const result = await login({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email,
    pin: parsed.data.pin
  })

  if (!result.ok) {
    if (result.code === 'INVALID_PIN') {
      return res.status(401).json({ success: false, code: 'INVALID_PIN', message: 'Invalid PIN' })
    }

    if (result.code === 'USER_NOT_FOUND') {
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND' })
    }

    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({ success: true, token: result.token, user: result.user })
})

const resetPinStartHandler = asyncHandler(async (req, res) => {
  const parsed = registerStartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid reset start payload' })
  }

  const result = await resetPinStart({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email
  })

  if (!result.ok) {
    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({
    success: true,
    next: 'verify-otp',
    userId: result.userId,
    otpSessionId: result.otpSessionId,
    delivery: result.delivery,
    devOtp: result.devOtp
  })
})

const resetPinOtpVerifyHandler = asyncHandler(async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid reset OTP payload' })
  }

  const result = await verifyResetPinOtp({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email,
    otp: parsed.data.otp
  })

  if (!result.ok) {
    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({ success: true, next: 'set-pin', userId: result.userId, otpSessionId: result.otpSessionId })
})

const resendOtpHandler = asyncHandler(async (req, res) => {
  const parsed = resendOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Invalid resend payload' })
  }

  const result = await resendOtpByMode({
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined,
    email: parsed.data.email,
    mode: parsed.data.mode
  })

  if (!result.ok) {
    return res.status(errorStatus(result.code)).json({ success: false, code: result.code, message: result.message })
  }

  return res.json({ success: true, message: 'OTP resent successfully', next: 'verify-otp', otpSessionId: result.otpSessionId })
})

authRouter.post('/identity/check', identityCheckHandler)
authRouter.post('/register/start', registerStartHandler)
authRouter.post('/register/otp/verify', registerOtpVerifyHandler)
authRouter.post('/pin/set', setPinHandler)
authRouter.post('/login', loginHandler)
authRouter.post('/pin/reset/start', resetPinStartHandler)
authRouter.post('/pin/reset/otp/verify', resetPinOtpVerifyHandler)
authRouter.post('/otp/resend', resendOtpHandler)
