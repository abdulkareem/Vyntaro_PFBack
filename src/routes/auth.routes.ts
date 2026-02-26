import { Router } from 'express'
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

/* ---------------- REGISTER START ---------------- */

const registerSchema = z.object({
  phone: phoneSchema,
  email: z.string().email().optional(),
  country: z.string().optional(),
  region: z.string().optional()
})

authRouter.post('/register/start', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const data = {
    ...parsed.data,
    phone: normalizePhone(parsed.data.phone)
  }

  const result = await registerStart(data)
  return res.json(result)
})

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const data = {
    ...parsed.data,
    phone: normalizePhone(parsed.data.phone)
  }

  const result = await registerStart(data)
  return res.json(result)
})

/* ---------------- REGISTER VERIFY OTP ---------------- */

authRouter.post('/register/verify', async (req, res) => {
  const schema = z.object({
    phone: phoneSchema,
    otp: z.string().length(6)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const phone = normalizePhone(parsed.data.phone)
  const result = await verifyRegistrationOtp(phone, parsed.data.otp)

  if (!result.ok) {
    return res.status(400).json(result)
  }

  return res.json(result)
})

/* ---------------- SET PIN ---------------- */

authRouter.post('/pin/set', async (req, res) => {
  const schema = z.object({
    phone: phoneSchema,
    pin: z.string().min(4).max(8)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const phone = normalizePhone(parsed.data.phone)
  const result = await setUserPin(phone, parsed.data.pin)

  if (!result.ok) {
    return res.status(400).json(result)
  }

  return res.json(result)
})

authRouter.post('/set-pin', async (req, res) => {
  const schema = z.object({
    phone: phoneSchema,
    pin: z.string().min(4).max(8)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const phone = normalizePhone(parsed.data.phone)
  const result = await setUserPin(phone, parsed.data.pin)

  if (!result.ok) {
    return res.status(400).json(result)
  }

  return res.json(result)
})

/* ---------------- LOGIN ---------------- */

authRouter.post('/login', async (req, res) => {
  const schema = z.object({
    phone: phoneSchema,
    pin: z.string().min(4).max(8)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const phone = normalizePhone(parsed.data.phone)
  const result = await login(phone, parsed.data.pin)

  if (!result.ok) {
    if (result.reason === 'pin_not_set') {
      return res.status(403).json(result)
    }
    return res.status(401).json(result)
  }

  return res.json(result)
})

/* ---------------- RESET PIN START ---------------- */

authRouter.post('/reset-pin/start', async (req, res) => {
  const schema = z.object({ phone: phoneSchema })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const phone = normalizePhone(parsed.data.phone)
  const result = await resetPinStart(phone)

  if (!result.ok) {
    return res.status(400).json(result)
  }

  return res.json(result)
})

/* ---------------- RESET PIN COMPLETE ---------------- */

authRouter.post('/reset-pin/complete', async (req, res) => {
  const schema = z.object({
    phone: phoneSchema,
    otp: z.string().length(6),
    pin: z.string().min(4).max(8)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const phone = normalizePhone(parsed.data.phone)
  const result = await resetPinComplete(phone, parsed.data.otp, parsed.data.pin)

  if (!result.ok) {
    return res.status(400).json(result)
  }

  return res.json(result)
})
