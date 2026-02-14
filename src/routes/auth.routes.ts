import { Router } from 'express'
import { z } from 'zod'
import { login, registerStart, setUserPin, verifyRegistrationOtp } from '../services/auth.service.js'

export const authRouter = Router()

const registerSchema = z.object({
  phone: z.string().regex(/^[0-9]{7,15}$/),
  email: z.string().email().optional(),
  country: z.string().optional(),
  region: z.string().optional()
})

authRouter.post('/register/start', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const result = await registerStart(parsed.data)
  return res.json(result)
})

authRouter.post('/register/verify', async (req, res) => {
  const schema = z.object({
    phone: z.string().regex(/^[0-9]{7,15}$/),
    otp: z.string().length(6)
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const result = await verifyRegistrationOtp(parsed.data.phone, parsed.data.otp)
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
})

authRouter.post('/pin/set', async (req, res) => {
  const schema = z.object({
    phone: z.string().regex(/^[0-9]{7,15}$/),
    pin: z.string().min(4).max(8)
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const result = await setUserPin(parsed.data.phone, parsed.data.pin)
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
})

authRouter.post('/login', async (req, res) => {
  const schema = z.object({
    phone: z.string().regex(/^[0-9]{7,15}$/),
    pin: z.string().min(4).max(8)
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const result = await login(parsed.data.phone, parsed.data.pin)
  if (!result.ok) return res.status(401).json(result)
  return res.json(result)
})
