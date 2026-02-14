import { redis } from '../plugins/redis.js'
import { hashOtp } from './otp.service.js'

const OTP_TTL = 300
const MAX_ATTEMPTS = 5

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

  await redis.set(key, JSON.stringify(data), 'EX', OTP_TTL)
}

export async function verifyOtp(phone: string, otp: string): Promise<OtpData> {
  const key = `otp:${phone}`
  const raw = await redis.get(key)

  if (!raw) {
    throw new Error('OTP expired')
  }

  const data = JSON.parse(raw) as OtpData

  if (data.attempts >= MAX_ATTEMPTS) {
    throw new Error('Too many attempts')
  }

  if (hashOtp(otp) !== data.hash) {
    data.attempts += 1
    await redis.set(key, JSON.stringify(data), 'EX', OTP_TTL)
    throw new Error('Invalid OTP')
  }

  await redis.del(key)
  return data
}
