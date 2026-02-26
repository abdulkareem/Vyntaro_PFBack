import { UserRole, UserStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { hashPin } from '../lib/security.js'

function envEnabled(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true'
}

export async function bootstrapAdminFromEnv() {
  if (!envEnabled(process.env.ADMIN_BOOTSTRAP_ENABLED)) return

  const phone = process.env.ADMIN_BOOTSTRAP_PHONE
  const pin = process.env.ADMIN_BOOTSTRAP_PIN

  if (!phone || !pin) {
    console.warn('Admin bootstrap skipped: ADMIN_BOOTSTRAP_PHONE or ADMIN_BOOTSTRAP_PIN is missing')
    return
  }

  const pinHash = await hashPin(pin)

  await prisma.$transaction(async (tx) => {
    const user = await tx.userAccount.upsert({
      where: { phone },
      create: {
        phone,
        verifiedAt: new Date(),
        userStatus: UserStatus.ACTIVE,
        role: UserRole.SUPER_ADMIN,
        pinSet: true
      },
      update: {
        verifiedAt: new Date(),
        userStatus: UserStatus.ACTIVE,
        role: UserRole.SUPER_ADMIN,
        pinSet: true
      }
    })

    await tx.userPin.upsert({
      where: { userId: user.id },
      create: { userId: user.id, pinHash },
      update: { pinHash }
    })
  })

  console.log('Admin bootstrap completed')
}
