import { AuthState, OtpPurpose, Prisma, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { comparePin, hashPin } from '../lib/security.js'
import { createAuthToken } from '../lib/token.js'
import { sendOtp } from '../messaging/otp.service.js'
import { hashOtp } from './otp.service.js'

const OTP_EXPIRY_MINUTES = 5
const OTP_MAX_ATTEMPTS = 3
const RESET_SESSION_MINUTES = 10

export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'USER_EXISTS'
  | 'USER_NOT_FOUND'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_LIMIT_EXCEEDED'
  | 'INVALID_PIN'
  | 'PIN_MISMATCH'
  | 'PIN_FORMAT_INVALID'
  | 'STATE_VIOLATION'

export type ServiceError = { ok: false; code: AuthErrorCode; message: string }

function error(code: AuthErrorCode, message: string): ServiceError {
  return { ok: false, code, message }
}

type IdentityInput = {
  phone?: string
  email?: string
}

type RegisterInput = IdentityInput & {
}

type SetPinInput = {
  userId: string
  pin: string
  confirmPin: string
}

type OtpIdentityInput = IdentityInput & {
  otp: string
}

function normalizeEmail(email?: string): string | undefined {
  return email?.trim().toLowerCase()
}

function generateReferralCode(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-6) || 'USER'
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${digits}${suffix}`
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function otpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
}

function resetSessionExpiryDate() {
  return new Date(Date.now() + RESET_SESSION_MINUTES * 60 * 1000)
}

function validatePin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

async function findUserByIdentity(input: IdentityInput) {
  if (input.phone) {
    return prisma.userAccount.findUnique({ where: { phone: input.phone } })
  }

  if (!input.email) return null
  return prisma.userAccount.findUnique({ where: { email: normalizeEmail(input.email) } })
}

async function transitionState(userId: string, toState: AuthState, reason: string) {
  const current = await prisma.userAccount.findUnique({ where: { id: userId }, select: { authState: true } })
  if (!current) return

  await prisma.$transaction([
    prisma.userAccount.update({ where: { id: userId }, data: { authState: toState } }),
    prisma.authStateTransition.create({
      data: {
        userId,
        fromState: current.authState,
        toState,
        reason
      }
    })
  ])
}

async function createOtpForPurpose(userId: string, otp: string, purpose: OtpPurpose) {
  await prisma.verificationCode.deleteMany({ where: { userId, purpose, consumedAt: null } })
  return prisma.verificationCode.create({
    data: {
      userId,
      purpose,
      channel: 'PHONE',
      codeHash: hashOtp(otp),
      expiresAt: otpExpiryDate(),
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      resendCount: 0
    }
  })
}

async function verifyOtpForPurpose(userId: string, otp: string, purpose: OtpPurpose, consume = true) {
  const code = await prisma.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' }
  })

  if (!code) return error('OTP_EXPIRED', 'OTP session is missing or expired')
  if (code.expiresAt < new Date()) return error('OTP_EXPIRED', 'OTP has expired')

  if (code.attempts >= code.maxAttempts) {
    return error('OTP_LIMIT_EXCEEDED', 'OTP attempt limit exceeded')
  }

  if (hashOtp(otp) !== code.codeHash) {
    const attempts = code.attempts + 1
    await prisma.verificationCode.update({ where: { id: code.id }, data: { attempts } })
    if (attempts >= code.maxAttempts) {
      return error('OTP_LIMIT_EXCEEDED', 'OTP attempt limit exceeded')
    }

    return error('OTP_INVALID', 'Invalid OTP')
  }

  if (consume) {
    await prisma.verificationCode.update({ where: { id: code.id }, data: { consumedAt: new Date() } })
  }

  return { ok: true as const, otpSessionId: code.id }
}

export async function registerStart(input: RegisterInput) {
  if (!input.phone && !input.email) {
    return error('INVALID_INPUT', 'Either phone or email is required')
  }

  const existingUser = await findUserByIdentity(input)
  if (existingUser) {
    return error('USER_EXISTS', 'User already exists')
  }

  if (!input.phone) {
    return error('INVALID_INPUT', 'Phone is required')
  }

  const user = await prisma.userAccount.create({
    data: {
      phone: input.phone,
      email: normalizeEmail(input.email),
      referralCode: generateReferralCode(input.phone),
      pinSet: false,
      role: UserRole.USER,
      authState: AuthState.IDENTITY_VERIFIED,
      pinResetAllowed: false
    }
  })

  const otp = generateOtp()
  const otpSession = await createOtpForPurpose(user.id, otp, OtpPurpose.REGISTER)
  const delivery = await sendOtp(user.phone, otp, user.email)

  return {
    ok: true as const,
    success: true as const,
    next: 'verify-otp' as const,
    userId: user.id,
    otpSessionId: otpSession.id,
    delivery,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : { otp }
  }
}

export async function verifyRegistrationOtp(input: OtpIdentityInput) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')

  const verification = await verifyOtpForPurpose(user.id, input.otp, OtpPurpose.REGISTER)
  if (!verification.ok) return verification

  await transitionState(user.id, AuthState.OTP_VERIFIED, 'register_otp_verified')

  return {
    ok: true as const,
    success: true as const,
    next: 'set-pin' as const,
    userId: user.id,
    otpSessionId: verification.otpSessionId
  }
}

export async function setUserPin(input: SetPinInput) {
  if (!validatePin(input.pin)) return error('PIN_FORMAT_INVALID', 'PIN must be exactly 4 digits')
  if (input.pin !== input.confirmPin) return error('PIN_MISMATCH', 'PIN and confirmPin must match')

  const user = await prisma.userAccount.findUnique({ where: { id: input.userId } })
  if (!user) return error('USER_NOT_FOUND', 'User not found')

  const canSetViaRegistration = user.authState === AuthState.OTP_VERIFIED
  const canSetViaReset = user.pinResetAllowed && !!user.pinResetAllowedUntil && user.pinResetAllowedUntil > new Date()

  if (!canSetViaRegistration && !canSetViaReset) {
    return error('STATE_VIOLATION', 'Current state does not allow PIN setup')
  }

  const pinHash = await hashPin(input.pin)
  await prisma.$transaction([
    prisma.userPin.upsert({
      where: { userId: user.id },
      create: { userId: user.id, pinHash },
      update: { pinHash }
    }),
    prisma.userAccount.update({
      where: { id: user.id },
      data: { pinSet: true, pinResetAllowed: false, pinResetAllowedUntil: null }
    })
  ])

  if (canSetViaRegistration) {
    await transitionState(user.id, AuthState.PIN_SET, 'pin_set_after_registration')
  }

  return { ok: true as const, success: true as const, next: 'login' as const }
}

export async function login(input: IdentityInput & { pin: string }) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')

  const savedPin = await prisma.userPin.findUnique({ where: { userId: user.id } })
  if (!savedPin) return error('INVALID_PIN', 'Invalid PIN')

  const valid = await comparePin(input.pin, savedPin.pinHash)
  if (!valid) return error('INVALID_PIN', 'Invalid PIN')

  if (user.authState !== AuthState.ACTIVE) {
    await transitionState(user.id, AuthState.ACTIVE, 'successful_login')
  }

  return { ok: true as const, success: true as const, token: createAuthToken(user.id, true, user.role) }
}

export async function resetPinStart(input: RegisterInput) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')

  const otp = generateOtp()
  const otpSession = await createOtpForPurpose(user.id, otp, OtpPurpose.PIN_RESET)
  await prisma.userAccount.update({ where: { id: user.id }, data: { pinResetAllowed: false, pinResetAllowedUntil: null } })

  const delivery = await sendOtp(user.phone, otp, user.email)
  return {
    ok: true as const,
    success: true as const,
    next: 'verify-otp' as const,
    userId: user.id,
    otpSessionId: otpSession.id,
    delivery,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : { otp }
  }
}

export async function verifyResetPinOtp(input: OtpIdentityInput) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')

  const verification = await verifyOtpForPurpose(user.id, input.otp, OtpPurpose.PIN_RESET)
  if (!verification.ok) return verification

  await prisma.userAccount.update({
    where: { id: user.id },
    data: {
      pinResetAllowed: true,
      pinResetAllowedUntil: resetSessionExpiryDate()
    }
  })

  return {
    ok: true as const,
    success: true as const,
    next: 'set-pin' as const,
    userId: user.id,
    otpSessionId: verification.otpSessionId
  }
}

export async function resendOtp(input: IdentityInput, purpose: OtpPurpose) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')

  const latest = await prisma.verificationCode.findFirst({
    where: { userId: user.id, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' }
  })

  if (!latest || latest.attempts < latest.maxAttempts) {
    return error('STATE_VIOLATION', 'OTP resend allowed only after max attempts are reached')
  }

  const otp = generateOtp()
  const otpSession = await createOtpForPurpose(user.id, otp, purpose)
  await sendOtp(user.phone, otp, user.email)

  return { ok: true as const, success: true as const, otpSessionId: otpSession.id }
}

export async function checkIdentity(input: IdentityInput) {
  const user = await findUserByIdentity(input)
  return { ok: true as const, exists: Boolean(user) }
}
