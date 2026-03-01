import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.userAccount.upsert({
    where: { phone: '+15555550123' },
    update: {},
    create: {
      phone: '+15555550123',
      email: 'demo@vyntaro.local',
      referralCode: 'DEMO1234',
      pinSet: true,
      role: UserRole.USER,
      authState: 'ACTIVE'
    }
  })

  await prisma.budgetPlan.create({ data: { userId: user.id, name: 'Default Monthly Budget' } })
}

main().finally(() => prisma.$disconnect())
