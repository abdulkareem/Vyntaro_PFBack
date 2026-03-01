import { redis } from '../plugins/redis.js'
import { hashOtp } from './otp.service.js'

const OTP_TTL = 300
const MAX_ATTEMPTS = 5

const inMemoryOtpStore = new Map<string, { payload: OtpData; expiresAt: number }>()

function purgeInMemoryOtp(key: string): void {
  const existing = inMemoryOtpStore.get(key)
  if (!existing) return
  if (existing.expiresAt <= Date.now()) {
    inMemoryOtpStore.delete(key)
  }
}

export interface OtpData {
  hash: string
  attempts: number
  phone: string
  email?: string | null
  country?: string
  region?: string
}

export async function createOtp(
  phone: string,
  otp: string,
  email: string | null,
  country?: string,
  region?: string
): Promise<void> {
  const key = `otp:${phone}`

  const data: OtpData = {
    hash: hashOtp(otp),
    attempts: 0,
    phone,
    email,
    country,
    region
  }

  try {
    if (!redis) throw new Error('redis_unavailable')
    await redis.set(key, JSON.stringify(data), 'EX', OTP_TTL)
  } catch {
    inMemoryOtpStore.set(key, { payload: data, expiresAt: Date.now() + OTP_TTL * 1000 })
  }
}

export async function verifyOtp(phone: string, otp: string, consume = true): Promise<OtpData> {
  const key = `otp:${phone}`
  let raw: string | null = null

  try {
    if (!redis) throw new Error('redis_unavailable')
    raw = await redis.get(key)
  } catch {
    purgeInMemoryOtp(key)
    const fallback = inMemoryOtpStore.get(key)
    raw = fallback ? JSON.stringify(fallback.payload) : null
  }

  if (!raw) {
    throw new Error('OTP expired')
  }

  const data = JSON.parse(raw) as OtpData

  if (data.attempts >= MAX_ATTEMPTS) {
    throw new Error('Too many attempts')
  }

  if (hashOtp(otp) !== data.hash) {
    data.attempts += 1
    try {
      if (!redis) throw new Error('redis_unavailable')
      await redis.set(key, JSON.stringify(data), 'EX', OTP_TTL)
    } catch {
      inMemoryOtpStore.set(key, { payload: data, expiresAt: Date.now() + OTP_TTL * 1000 })
    }
    throw new Error('Invalid OTP')
  }

  if (consume) {
    try {
      if (!redis) throw new Error('redis_unavailable')
      await redis.del(key)
    } catch {
      inMemoryOtpStore.delete(key)
    }
  }

  return data
}
