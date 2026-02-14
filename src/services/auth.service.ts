import { OtpChannel, UserStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { comparePin, generateOtp, hashOtp, hashPin } from '../lib/security.js'
import { sendEmailOtp } from '../messaging/email/email.service.js'
import { sendOtp } from '../messaging/otp.service.js'

const OTP_TTL_MS = 5 * 60_000

type RegisterInput = {
  phone: string
  email?: string
  country?: string
  region?: string
}

export async function registerStart(input: RegisterInput) {
  const user = await prisma.userAccount.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      email: input.email,
      country: input.country,
      region: input.region
    },
    update: {
      email: input.email,
      country: input.country,
      region: input.region
    }
  })

  const phoneOtp = generateOtp()
  const emailOtp = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  await prisma.verificationCode.createMany({
    data: [
      { userId: user.id, channel: OtpChannel.PHONE, codeHash: hashOtp(phoneOtp), expiresAt },
      { userId: user.id, channel: OtpChannel.EMAIL, codeHash: hashOtp(emailOtp), expiresAt }
    ]
  })

  await sendOtp(input.phone, phoneOtp)
  if (input.email) {
    sendEmailOtp(input.email, emailOtp).catch(() => {})
  }

  return {
    userId: user.id,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : { phoneOtp, emailOtp }
  }
}

export async function verifyRegistrationOtp(phone: string, phoneCode: string, emailCode: string) {
  const user = await prisma.userAccount.findUnique({ where: { phone } })
  if (!user) return { ok: false as const, reason: 'not_found' as const }

  const records = await prisma.verificationCode.findMany({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() }, channel: { in: [OtpChannel.PHONE, OtpChannel.EMAIL] } },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  const phoneMatch = records.find(r => r.channel === OtpChannel.PHONE && r.codeHash === hashOtp(phoneCode))
  const emailMatch = records.find(r => r.channel === OtpChannel.EMAIL && r.codeHash === hashOtp(emailCode))

  if (!phoneMatch || !emailMatch) return { ok: false as const, reason: 'invalid' as const }

  await prisma.$transaction([
    prisma.verificationCode.update({ where: { id: phoneMatch.id }, data: { consumedAt: new Date() } }),
    prisma.verificationCode.update({ where: { id: emailMatch.id }, data: { consumedAt: new Date() } }),
    prisma.userAccount.update({ where: { id: user.id }, data: { verifiedAt: new Date(), userStatus: UserStatus.ACTIVE } })
  ])

  return { ok: true as const }
}

export async function setUserPin(phone: string, pin: string) {
  const user = await prisma.userAccount.findUnique({ where: { phone } })
  if (!user?.verifiedAt) return { ok: false as const, reason: 'not_verified' as const }

  const pinHash = await hashPin(pin)
  await prisma.userPin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, pinHash },
    update: { pinHash }
  })

  return { ok: true as const }
}

export async function login(phone: string, pin: string) {
  const user = await prisma.userAccount.findUnique({ where: { phone }, include: { userPin: true } })
  if (!user?.userPin) return { ok: false as const, reason: 'not_found' as const }

  const valid = await comparePin(pin, user.userPin.pinHash)
  if (!valid) return { ok: false as const, reason: 'invalid' as const }

  return {
    ok: true as const,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      verifiedAt: user.verifiedAt
    }
  }
}
