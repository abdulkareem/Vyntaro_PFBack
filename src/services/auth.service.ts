import { AuthState, OtpPurpose, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { comparePin, hashPin } from '../lib/security.js'
import { createAuthToken } from '../lib/token.js'
import { sendOtp } from '../messaging/otp.service.js'
import { hashOtp } from './otp.service.js'
import { issueRefreshToken, revokeUserRefreshTokens, rotateRefreshToken } from './session.service.js'

const OTP_EXPIRY_MINUTES = 5
const OTP_MAX_ATTEMPTS = 3

type IdentityInput = { phone?: string; email?: string }

type AuthUserShape = {
  id: string
  phone: string
  email: string | null
  verifiedAt?: string | null
  avatarUrl?: string | null
  pinSet: boolean
  role: UserRole
}

export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'USER_EXISTS'
  | 'USER_NOT_FOUND'
  | 'ACCOUNT_NOT_FOUND'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_LIMIT_EXCEEDED'
  | 'INVALID_PIN'
  | 'PIN_FORMAT_INVALID'
  | 'OTP_SESSION_REQUIRED'

export type ServiceError = { ok: false; code: AuthErrorCode; message: string }
function error(code: AuthErrorCode, message: string): ServiceError { return { ok: false, code, message } }

const normalizeEmail = (email?: string) => email?.trim().toLowerCase()
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()
const validatePin = (pin: string) => /^\d{4}$/.test(pin)
const expiryDate = () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

function mapUser(user: { id: string; phone: string; email: string | null; pinSet: boolean; role: UserRole }): AuthUserShape {
  return { id: user.id, phone: user.phone, email: user.email, pinSet: user.pinSet, role: user.role, verifiedAt: null, avatarUrl: null }
}

async function findUserByIdentity(input: IdentityInput) {
  if (input.phone) return prisma.userAccount.findUnique({ where: { phone: input.phone } })
  if (!input.email) return null
  return prisma.userAccount.findUnique({ where: { email: normalizeEmail(input.email) } })
}

async function createOtpForPurpose(userId: string, otp: string, purpose: OtpPurpose) {
  await prisma.verificationCode.deleteMany({ where: { userId, purpose, consumedAt: null } })
  return prisma.verificationCode.create({ data: { userId, purpose, channel: 'PHONE', codeHash: hashOtp(otp), expiresAt: expiryDate(), attempts: 0, maxAttempts: OTP_MAX_ATTEMPTS, resendCount: 0 } })
}

async function verifyOtpForPurpose(userId: string, otp: string, purpose: OtpPurpose) {
  const code = await prisma.verificationCode.findFirst({ where: { userId, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } })
  if (!code || code.expiresAt < new Date()) return error('OTP_EXPIRED', 'OTP has expired')
  if (code.attempts >= code.maxAttempts) return error('OTP_LIMIT_EXCEEDED', 'OTP attempt limit exceeded')
  if (hashOtp(otp) !== code.codeHash) {
    const attempts = code.attempts + 1
    await prisma.verificationCode.update({ where: { id: code.id }, data: { attempts } })
    return attempts >= code.maxAttempts ? error('OTP_LIMIT_EXCEEDED', 'OTP attempt limit exceeded') : error('OTP_INVALID', 'Invalid OTP')
  }
  await prisma.verificationCode.update({ where: { id: code.id }, data: { consumedAt: new Date() } })
  return { ok: true as const, otpSessionId: code.id }
}

export async function checkIdentity(input: IdentityInput & { phone?: string; email?: string }) {
  const phoneUser = input.phone ? await prisma.userAccount.findUnique({ where: { phone: input.phone } }) : null
  const emailUser = input.email ? await prisma.userAccount.findUnique({ where: { email: normalizeEmail(input.email) } }) : null
  return { ok: true as const, exists: Boolean(phoneUser || emailUser), phoneExists: Boolean(phoneUser), emailExists: Boolean(emailUser), next: phoneUser || emailUser ? 'login' : 'register/start' }
}

export async function registerStart(input: IdentityInput) {
  if (!input.phone) return error('INVALID_INPUT', 'Phone is required')
  if (await findUserByIdentity(input)) return error('USER_EXISTS', 'User already exists')

  const user = await prisma.userAccount.create({ data: { phone: input.phone, email: normalizeEmail(input.email), referralCode: `${input.phone.slice(-6)}${Math.random().toString(36).slice(2, 8).toUpperCase()}`, pinSet: false, role: UserRole.USER, authState: AuthState.IDENTITY_VERIFIED } })
  const otp = generateOtp()
  await createOtpForPurpose(user.id, otp, OtpPurpose.REGISTER)
  await sendOtp(user.phone, otp, user.email)
  return { ok: true as const, userId: user.id, next: 'register/verify', devOtp: process.env.NODE_ENV === 'production' ? undefined : { phoneOtp: otp, emailOtp: otp } }
}

export async function verifyRegistrationOtp(input: IdentityInput & { otp: string }) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')
  const verification = await verifyOtpForPurpose(user.id, input.otp, OtpPurpose.REGISTER)
  if (!verification.ok) return verification

  await prisma.userAccount.update({ where: { id: user.id }, data: { authState: AuthState.OTP_VERIFIED } })
  const temporaryAuthToken = createAuthToken(user.id, false, user.role)
  return { ok: true as const, user: mapUser(user), userId: user.id, otpSessionId: verification.otpSessionId, verificationToken: verification.otpSessionId, temporaryAuthToken, next: 'pin/set' }
}

async function loginEnvelope(user: { id: string; phone: string; email: string | null; pinSet: boolean; role: UserRole }) {
  const accessToken = createAuthToken(user.id, user.pinSet, user.role)
  const refreshToken = issueRefreshToken(user.id)
  return { ok: true as const, user: mapUser(user), accessToken, refreshToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), next: 'dashboard' }
}

export async function login(input: IdentityInput & { identifier?: string; pin: string }) {
  const resolved = input.identifier
    ? input.identifier.includes('@')
      ? { ...input, email: input.identifier }
      : { ...input, phone: input.identifier }
    : input
  const user = await findUserByIdentity(resolved)
  if (!user) return error('ACCOUNT_NOT_FOUND', 'Account not found')

  const savedPin = await prisma.userPin.findUnique({ where: { userId: user.id } })
  if (!savedPin) return error('INVALID_PIN', 'Invalid PIN')
  const valid = await comparePin(input.pin, savedPin.pinHash)
  if (!valid) return error('INVALID_PIN', 'Invalid PIN')

  if (user.authState !== AuthState.ACTIVE) {
    await prisma.userAccount.update({ where: { id: user.id }, data: { authState: AuthState.ACTIVE } })
  }

  return loginEnvelope(user)
}

export async function refreshAuth(refreshToken: string) {
  const rotated = rotateRefreshToken(refreshToken)
  if (!rotated) return error('USER_NOT_FOUND', 'Invalid refresh token')
  const user = await prisma.userAccount.findUnique({ where: { id: rotated.userId } })
  if (!user) return error('USER_NOT_FOUND', 'User not found')
  const accessToken = createAuthToken(user.id, user.pinSet, user.role)
  return { ok: true as const, user: mapUser(user), accessToken, refreshToken: rotated.refreshToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), next: 'dashboard' }
}

export async function otpRequest(input: IdentityInput, purpose: OtpPurpose = OtpPurpose.REGISTER) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')
  const otp = generateOtp()
  await createOtpForPurpose(user.id, otp, purpose)
  await sendOtp(user.phone, otp, user.email)
  return { ok: true as const, next: 'otp/verify', devOtp: process.env.NODE_ENV === 'production' ? undefined : { phoneOtp: otp, emailOtp: otp } }
}

export async function otpVerify(input: IdentityInput & { otp: string; purpose?: 'register' | 'reset' }) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')
  const purpose = input.purpose === 'reset' ? OtpPurpose.PIN_RESET : OtpPurpose.REGISTER
  return verifyOtpForPurpose(user.id, input.otp, purpose)
}

export async function resetPinStart(input: IdentityInput) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')
  const otp = generateOtp()
  await createOtpForPurpose(user.id, otp, OtpPurpose.PIN_RESET)
  await sendOtp(user.phone, otp, user.email)
  return { ok: true as const, userId: user.id, next: 'pin/reset/verify', devOtp: process.env.NODE_ENV === 'production' ? undefined : { phoneOtp: otp, emailOtp: otp } }
}

export async function verifyResetPinOtp(input: IdentityInput & { otp: string }) {
  const user = await findUserByIdentity(input)
  if (!user) return error('USER_NOT_FOUND', 'User not found')
  const verification = await verifyOtpForPurpose(user.id, input.otp, OtpPurpose.PIN_RESET)
  if (!verification.ok) return verification
  await prisma.userAccount.update({ where: { id: user.id }, data: { pinResetAllowed: true, pinResetAllowedUntil: expiryDate() } })
  return { ok: true as const, userId: user.id, otpSessionId: verification.otpSessionId, next: 'pin/reset/complete' }
}

export async function setUserPin(input: { pin: string; mode: 'register' | 'reset'; otpSessionId: string }) {
  if (!validatePin(input.pin)) return error('PIN_FORMAT_INVALID', 'PIN must be exactly 4 numeric digits')
  const otpSession = await prisma.verificationCode.findUnique({ where: { id: input.otpSessionId }, include: { user: true } })
  if (!otpSession || otpSession.expiresAt < new Date()) return error('OTP_SESSION_REQUIRED', 'OTP session required')
  const requiredPurpose = input.mode === 'register' ? OtpPurpose.REGISTER : OtpPurpose.PIN_RESET
  if (otpSession.purpose !== requiredPurpose || !otpSession.consumedAt) return error('OTP_SESSION_REQUIRED', 'OTP session required')

  const pinHash = await hashPin(input.pin)
  await prisma.userPin.upsert({ where: { userId: otpSession.userId }, create: { userId: otpSession.userId, pinHash }, update: { pinHash } })
  await prisma.userAccount.update({ where: { id: otpSession.userId }, data: { pinSet: true, pinResetAllowed: false, pinResetAllowedUntil: null, authState: AuthState.PIN_SET } })
  revokeUserRefreshTokens(otpSession.userId)
  return { ok: true as const, next: 'login' }
}

export async function changePin(input: { userId: string; currentPin: string; newPin: string }) {
  if (!validatePin(input.newPin)) return error('PIN_FORMAT_INVALID', 'PIN must be exactly 4 numeric digits')
  const saved = await prisma.userPin.findUnique({ where: { userId: input.userId } })
  if (!saved) return error('USER_NOT_FOUND', 'User not found')
  if (!(await comparePin(input.currentPin, saved.pinHash))) return error('INVALID_PIN', 'Invalid PIN')
  await prisma.userPin.update({ where: { userId: input.userId }, data: { pinHash: await hashPin(input.newPin) } })
  revokeUserRefreshTokens(input.userId)
  return { ok: true as const }
}

export async function updateProfile(input: { userId: string; email?: string; phone?: string; avatarUrl?: string; otpToken: string }) {
  const session = await prisma.verificationCode.findUnique({ where: { id: input.otpToken } })
  if (!session || session.userId !== input.userId || session.expiresAt < new Date()) return error('OTP_EXPIRED', 'OTP verification expired')
  const user = await prisma.userAccount.update({ where: { id: input.userId }, data: { email: input.email ? normalizeEmail(input.email) : undefined, phone: input.phone, updatedAt: new Date() } })
  return { ok: true as const, user: { id: user.id, phone: user.phone, email: user.email, verifiedAt: null, avatarUrl: input.avatarUrl ?? null } }
}
