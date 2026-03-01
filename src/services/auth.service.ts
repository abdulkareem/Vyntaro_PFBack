import { Prisma, UserRole, UserStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { comparePin, hashPin } from '../lib/security.js'
import { createAuthToken } from '../lib/token.js'
import { sendOtp } from '../messaging/otp.service.js'
import { createOtp, verifyOtp } from './otp.store.js'
import { generateOtp } from './otp.service.js'

type RegisterInput = {
  phone: string
  email?: string
  country?: string
  region?: string
}

type CompatUser = {
  id: string
  phone: string
  email: string | null
  country?: string | null
  region?: string | null
  userStatus: UserStatus
  role?: UserRole
  pinSet?: boolean
  userPin?: { pinHash: string } | null
}

function generateReferralCode(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-6) || 'USER'
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${digits}${suffix}`
}

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022'
}

function normalizeOtpFailure(error: unknown): 'otp_expired' | 'otp_attempt_limit_reached' | 'invalid_otp' {
  const message = error instanceof Error ? error.message : 'invalid'
  if (message === 'OTP expired') return 'otp_expired'
  if (message === 'Too many attempts') return 'otp_attempt_limit_reached'
  return 'invalid_otp'
}

async function findUserByPhoneCompat(phone: string, includePin = false): Promise<CompatUser | null> {
  try {
    return await prisma.userAccount.findUnique({
      where: { phone },
      include: includePin ? { userPin: true } : undefined
    })
  } catch (error) {
    if (!isMissingColumnError(error)) throw error

    const fallbackUser = await prisma.userAccount.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        email: true,
        userStatus: true,
        userPin: includePin ? { select: { pinHash: true } } : false
      }
    })

    if (!fallbackUser) return null
    return { ...fallbackUser, role: UserRole.USER, pinSet: Boolean(fallbackUser.userPin) }
  }
}

export async function registerStart(input: RegisterInput) {
  const existingUser = await findUserByPhoneCompat(input.phone)
  if (existingUser) {
    let devOtp: string | undefined
    if (existingUser.userStatus !== UserStatus.ACTIVE) {
      const otp = generateOtp()
      await createOtp(input.phone, otp, existingUser.email, existingUser.country ?? undefined, existingUser.region ?? undefined)
      const delivery = await sendOtp(input.phone, otp, existingUser.email)
      devOtp = otp

      return {
        ok: true as const,
        user: {
          id: existingUser.id,
          phone: existingUser.phone,
          email: existingUser.email,
          pinSet: existingUser.pinSet,
          role: existingUser.role
        },
        delivery,
        next: '/verify-otp',
        devOtp: process.env.NODE_ENV === 'production' || !devOtp ? undefined : { otp: devOtp }
      }
    }

    return {
      ok: true as const,
      user: {
        id: existingUser.id,
        phone: existingUser.phone,
        email: existingUser.email,
        pinSet: existingUser.pinSet,
        role: existingUser.role
      },
      next: existingUser.pinSet ? '/login' : '/set-pin'
    }
  }

  let user: CompatUser
  try {
    user = await prisma.userAccount.create({
      data: {
        phone: input.phone,
        email: input.email,
        referralCode: generateReferralCode(input.phone),
        pinSet: false,
        role: UserRole.USER,
        userStatus: UserStatus.GHOST
      }
    })
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    user = await prisma.userAccount.create({
      data: {
        phone: input.phone,
        email: input.email,
        referralCode: generateReferralCode(input.phone),
        userStatus: UserStatus.GHOST
      }
    })
  }

  const otp = generateOtp()
  await createOtp(input.phone, otp, input.email ?? null, input.country, input.region)
  const delivery = await sendOtp(input.phone, otp, input.email)

  return {
    ok: true as const,
    userId: user.id,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      pinSet: user.pinSet ?? false,
      role: user.role ?? UserRole.USER
    },
    delivery,
    next: '/verify-otp',
    devOtp: process.env.NODE_ENV === 'production' ? undefined : { otp }
  }
}

export async function verifyRegistrationOtp(phone: string, otp: string) {
  const user = await findUserByPhoneCompat(phone)
  if (!user) return { ok: false as const, reason: 'not_found' as const }

  try {
    await verifyOtp(phone, otp)
  } catch (error) {
    return { ok: false as const, reason: normalizeOtpFailure(error) }
  }

  const updatedUser = await prisma.userAccount.update({
    where: { id: user.id },
    data: { userStatus: UserStatus.ACTIVE }
  })

  return {
    ok: true as const,
    user: {
      id: updatedUser.id,
      phone: updatedUser.phone,
      email: updatedUser.email
    },
    next: '/dashboard'
  }
}

export async function setUserPin(phone: string, pin: string) {
  const user = await prisma.userAccount.findUnique({ where: { phone } })
  if (!user || user.userStatus !== UserStatus.ACTIVE) {
    return { ok: false as const, reason: 'not_verified' as const }
  }

  const pinHash = await hashPin(pin)
  await prisma.$transaction([
    prisma.userPin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, pinHash },
    update: { pinHash }
    }),
    prisma.userAccount.update({
      where: { id: user.id },
      data: { pinSet: true }
    })
  ])

  return { ok: true as const }
}

export async function login(phone: string, pin: string) {
  const user = await findUserByPhoneCompat(phone, true)
  if (!user || user.userStatus !== UserStatus.ACTIVE) {
    return { ok: false as const, reason: 'invalid_credentials' as const }
  }
  const pinSet = user.pinSet ?? Boolean(user.userPin)
  if (!pinSet || !user.userPin) return { ok: false as const, reason: 'pin_not_set' as const }

  const valid = await comparePin(pin, user.userPin.pinHash)
  if (!valid) return { ok: false as const, reason: 'invalid_credentials' as const }

  return {
    ok: true as const,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      pinSet,
      role: user.role ?? UserRole.USER
    },
    token: createAuthToken(user.id, pinSet, user.role ?? UserRole.USER),
    next: '/dashboard'
  }
}

export async function resetPinStart(phone: string) {
  const user = await findUserByPhoneCompat(phone)
  if (!user || user.userStatus !== UserStatus.ACTIVE) {
    return { ok: false as const, reason: 'not_verified' as const }
  }

  const otp = generateOtp()
  await createOtp(phone, otp, user.email ?? null, user.country ?? undefined, user.region ?? undefined)

  const delivery = await sendOtp(phone, otp, user.email)

  return {
    ok: true as const,
    delivery,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : { otp }
  }
}

export async function resetPinComplete(phone: string, otp: string, pin: string) {
  const user = await findUserByPhoneCompat(phone)
  if (!user || user.userStatus !== UserStatus.ACTIVE) {
    return { ok: false as const, reason: 'not_verified' as const }
  }

  try {
    await verifyOtp(phone, otp)
  } catch (error) {
    return { ok: false as const, reason: normalizeOtpFailure(error) }
  }

  const pinHash = await hashPin(pin)
  await prisma.$transaction([
    prisma.userPin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, pinHash },
    update: { pinHash }
    }),
    prisma.userAccount.update({
      where: { id: user.id },
      data: { pinSet: true }
    })
  ])

  return { ok: true as const }
}

export async function checkIdentity(phone: string) {
  const user = await findUserByPhoneCompat(phone)
  if (!user) {
    return {
      ok: true as const,
      exists: false,
      verified: false,
      pinSet: false,
      next: '/register/start'
    }
  }

  const verified = user.userStatus === UserStatus.ACTIVE
  const pinSet = user.pinSet ?? false

  return {
    ok: true as const,
    exists: true,
    verified,
    pinSet,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role ?? UserRole.USER
    },
    next: verified ? (pinSet ? '/login' : '/set-pin') : '/verify-otp'
  }
}
