import crypto from 'node:crypto'

/**
 * Generate a 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Hash OTP using SHA-256.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex')
}
