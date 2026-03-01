import { AccountType, CategoryBucket, CategoryKind, EntryDirection, EntrySource, PrismaClient, UserRole } from '@prisma/client'

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

  const [asset, incomeAccount, expenseAccount] = await Promise.all([
    prisma.financialAccount.upsert({ where: { id: `${user.id}-asset` }, update: {}, create: { id: `${user.id}-asset`, userId: user.id, name: 'Cash Wallet', accountType: AccountType.ASSET, openingBalance: 0 } }),
    prisma.financialAccount.upsert({ where: { id: `${user.id}-income` }, update: {}, create: { id: `${user.id}-income`, userId: user.id, name: 'Income Ledger', accountType: AccountType.INCOME, openingBalance: 0 } }),
    prisma.financialAccount.upsert({ where: { id: `${user.id}-expense` }, update: {}, create: { id: `${user.id}-expense`, userId: user.id, name: 'Expense Ledger', accountType: AccountType.EXPENSE, openingBalance: 0 } })
  ])

  const categories = [
    { name: 'Salary', slug: 'salary', kind: CategoryKind.INCOME, bucket: CategoryBucket.OTHER, showOnDashboard: true, dashboardOrder: 1 },
    { name: 'Food', slug: 'food', kind: CategoryKind.EXPENSE, bucket: CategoryBucket.FOOD, showOnDashboard: true, dashboardOrder: 2 },
    { name: 'Charity', slug: 'charity', kind: CategoryKind.EXPENSE, bucket: CategoryBucket.CHARITY, showOnDashboard: true, dashboardOrder: 3 },
    { name: 'Loan', slug: 'loan', kind: CategoryKind.EXPENSE, bucket: CategoryBucket.MONEY_BORROWED, showOnDashboard: true, dashboardOrder: 4 },
    { name: 'Money Lent', slug: 'money-lent', kind: CategoryKind.EXPENSE, bucket: CategoryBucket.MONEY_LENT, showOnDashboard: true, dashboardOrder: 5 }
  ] as const

  for (const category of categories) {
    await prisma.category.upsert({
      where: { userId_slug: { userId: user.id, slug: category.slug } },
      update: category,
      create: { userId: user.id, ...category }
    })
  }

  const salary = await prisma.category.findUniqueOrThrow({ where: { userId_slug: { userId: user.id, slug: 'salary' } } })
  const food = await prisma.category.findUniqueOrThrow({ where: { userId_slug: { userId: user.id, slug: 'food' } } })
  const charity = await prisma.category.findUniqueOrThrow({ where: { userId_slug: { userId: user.id, slug: 'charity' } } })

  const entry = await prisma.journalEntry.create({ data: { userId: user.id, source: EntrySource.MANUAL, transactionDate: new Date(), description: 'Seed salary + expenses' } })
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: entry.id, accountId: asset.id, categoryId: salary.id, direction: EntryDirection.DEBIT, amount: 5000 },
      { journalEntryId: entry.id, accountId: incomeAccount.id, categoryId: salary.id, direction: EntryDirection.CREDIT, amount: 5000 },
      { journalEntryId: entry.id, accountId: expenseAccount.id, categoryId: food.id, direction: EntryDirection.DEBIT, amount: 1400 },
      { journalEntryId: entry.id, accountId: asset.id, categoryId: food.id, direction: EntryDirection.CREDIT, amount: 1400 },
      { journalEntryId: entry.id, accountId: expenseAccount.id, categoryId: charity.id, direction: EntryDirection.DEBIT, amount: 500 },
      { journalEntryId: entry.id, accountId: asset.id, categoryId: charity.id, direction: EntryDirection.CREDIT, amount: 500 }
    ]
  })

  await prisma.budgetPlan.upsert({
    where: { id: `${user.id}-default-budget` },
    update: { name: 'Default Monthly Budget', monthlyLimit: 4000, yearlyLimit: 48000 },
    create: { id: `${user.id}-default-budget`, userId: user.id, name: 'Default Monthly Budget', monthlyLimit: 4000, yearlyLimit: 48000 }
  })

  await prisma.lendingRecord.createMany({
    data: [
      { userId: user.id, person: 'Alex', kind: 'LENT', principalAmount: 800, currentBalance: 800, status: 'OPEN' },
      { userId: user.id, person: 'Bank EMI', kind: 'LOAN', principalAmount: 2500, currentBalance: 2100, status: 'OPEN' }
    ],
    skipDuplicates: true
  })
}

main().finally(() => prisma.$disconnect())
