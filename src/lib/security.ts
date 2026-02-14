import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10)
}

export async function comparePin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash)
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function hashOtp(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}
