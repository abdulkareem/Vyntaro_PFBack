import { AccountType, CategoryBucket, CategoryKind, EntryDirection, EntrySource, Prisma } from '@prisma/client'
import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.middleware.js'

export const ledgerRouter = Router()

ledgerRouter.use(requireAuth)

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['income', 'expense', 'bill', 'ledger'])
})

const createEntrySchema = z.object({
  amount: z.coerce.number().positive(),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1),
  description: z.string().trim().max(300).optional(),
  date: z.coerce.date().optional()
})

const listEntryQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
})

const defaultCategories: Array<{ name: string; type: 'income' | 'expense'; bucket: CategoryBucket }> = [
  { name: 'Salary', type: 'income', bucket: CategoryBucket.OTHER },
  { name: 'Freelance', type: 'income', bucket: CategoryBucket.OTHER },
  { name: 'Food', type: 'expense', bucket: CategoryBucket.FOOD },
  { name: 'Rent', type: 'expense', bucket: CategoryBucket.HOUSING },
  { name: 'Travel', type: 'expense', bucket: CategoryBucket.TRANSPORT },
  { name: 'Health', type: 'expense', bucket: CategoryBucket.HEALTH },
  { name: 'Entertainment', type: 'expense', bucket: CategoryBucket.ENTERTAINMENT }
]

const idempotencyStore = new Map<string, unknown>()

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function toCategoryKind(type: 'income' | 'expense' | 'bill' | 'ledger') {
  return type === 'income' ? CategoryKind.INCOME : CategoryKind.EXPENSE
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toAmount(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2))
}

function mapCategory(category: { id: string; name: string; kind: CategoryKind }) {
  return {
    id: category.id,
    name: category.name,
    type: category.kind === CategoryKind.INCOME ? 'income' : 'expense'
  }
}

async function ensureDefaultCategories(userId: string) {
  const existingCount = await prisma.category.count({ where: { userId } })
  if (existingCount > 0) return

  await prisma.category.createMany({
    data: defaultCategories.map((category) => ({
      userId,
      name: category.name,
      slug: toSlug(category.name),
      kind: toCategoryKind(category.type),
      bucket: category.bucket
    })),
    skipDuplicates: true
  })
}

async function getOrCreateSystemAccount(userId: string, accountType: AccountType) {
  const accountName = accountType === AccountType.ASSET ? 'Cash Wallet' : accountType === AccountType.INCOME ? 'Income Ledger' : 'Expense Ledger'

  const existing = await prisma.financialAccount.findFirst({
    where: { userId, accountType, name: accountName },
    select: { id: true }
  })

  if (existing) return existing

  return prisma.financialAccount.create({
    data: {
      userId,
      name: accountName,
      accountType,
      openingBalance: new Prisma.Decimal(0)
    },
    select: { id: true }
  })
}

ledgerRouter.get('/categories', asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? req.authUserId
  if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' })

  await ensureDefaultCategories(userId)
  const type = req.query.type?.toString()
  const categories = await prisma.category.findMany({
    where: { userId, ...(type === 'income' ? { kind: CategoryKind.INCOME } : type === 'expense' || type === 'bill' || type === 'ledger' ? { kind: CategoryKind.EXPENSE } : {}) },
    select: { id: true, name: true, kind: true },
    orderBy: { name: 'asc' }
  })

  return res.json({ success: true, data: categories.map(mapCategory) })
}))

ledgerRouter.post('/categories', asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? req.authUserId
  if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' })

  const parsed = createCategorySchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ success: false, error: 'INVALID_INPUT', fields: parsed.error.flatten().fieldErrors })

  const name = parsed.data.name
  const slug = toSlug(name)

  const existing = await prisma.category.findUnique({ where: { userId_slug: { userId, slug } }, select: { id: true, name: true, kind: true } })
  if (existing) return res.status(409).json({ success: false, error: 'CATEGORY_EXISTS' })

  const category = await prisma.category.create({
    data: { userId, name, slug, kind: toCategoryKind(parsed.data.type), bucket: CategoryBucket.OTHER },
    select: { id: true, name: true, kind: true }
  })

  return res.status(201).json({ success: true, data: mapCategory(category) })
}))

ledgerRouter.patch('/categories/:id', asyncHandler(async (req, res) => {
  const userId = req.authUserId!
  const parsed = createCategorySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ success: false, error: 'INVALID_INPUT', fields: parsed.error.flatten().fieldErrors })
  const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId }, select: { id: true } })
  if (!existing) return res.status(404).json({ success: false, error: 'CATEGORY_NOT_FOUND' })
  const updated = await prisma.category.update({ where: { id: existing.id }, data: { name: parsed.data.name, kind: parsed.data.type ? toCategoryKind(parsed.data.type) : undefined } , select: { id: true, name: true, kind: true }})
  return res.json({ success: true, data: mapCategory(updated) })
}))

ledgerRouter.get('/entries', asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? req.authUserId
  if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' })

  const query = listEntryQuery.safeParse(req.query)
  if (!query.success) return res.status(422).json({ success: false, error: 'INVALID_INPUT', fields: query.error.flatten().fieldErrors })
  const page = query.data.page ?? 1
  const pageSize = query.data.pageSize ?? 50

  const entries = await prisma.journalEntry.findMany({
    where: {
      userId,
      transactionDate: { gte: query.data.from, lte: query.data.to },
      ...(query.data.search ? { description: { contains: query.data.search, mode: 'insensitive' } } : {}),
      lines: {
        some: {
          ...(query.data.categoryId ? { categoryId: query.data.categoryId } : {}),
          ...(query.data.type ? { account: { accountType: query.data.type === 'income' ? AccountType.INCOME : AccountType.EXPENSE } } : {})
        }
      }
    },
    orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      description: true,
      transactionDate: true,
      lines: { where: { categoryId: { not: null } }, select: { amount: true, categoryId: true, account: { select: { accountType: true } } } }
    }
  })

  const data = entries.map((entry) => {
    const line = entry.lines[0]
    if (!line || !line.categoryId) return null
    const type = line.account.accountType === AccountType.INCOME ? 'income' : line.account.accountType === AccountType.EXPENSE ? 'expense' : null
    if (!type) return null
    return { id: entry.id, amount: Number(line.amount), type, categoryId: line.categoryId, description: entry.description ?? '', date: entry.transactionDate.toISOString() }
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  return res.json({ success: true, data })
}))

ledgerRouter.post('/entries', asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? req.authUserId
  if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' })

  const idem = req.header('idempotency-key')
  if (idem && idempotencyStore.has(`${userId}:${idem}`)) return res.status(201).json(idempotencyStore.get(`${userId}:${idem}`))

  const parsed = createEntrySchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ success: false, error: 'INVALID_INPUT', fields: parsed.error.flatten().fieldErrors })

  const category = await prisma.category.findFirst({ where: { id: parsed.data.categoryId, userId }, select: { id: true, kind: true } })
  if (!category) return res.status(404).json({ success: false, error: 'CATEGORY_NOT_FOUND' })
  if (category.kind !== toCategoryKind(parsed.data.type)) return res.status(400).json({ success: false, error: 'CATEGORY_TYPE_MISMATCH' })

  const entryDate = parsed.data.date ?? new Date()
  const amount = toAmount(parsed.data.amount)

  const [cashAccount, statementAccount] = await Promise.all([
    getOrCreateSystemAccount(userId, AccountType.ASSET),
    getOrCreateSystemAccount(userId, parsed.data.type === 'income' ? AccountType.INCOME : AccountType.EXPENSE)
  ])

  const entry = await prisma.$transaction(async (tx) => {
    const createdEntry = await tx.journalEntry.create({ data: { userId, transactionDate: entryDate, source: EntrySource.MANUAL, description: parsed.data.description }, select: { id: true, transactionDate: true, description: true } })
    await tx.journalLine.createMany({ data: parsed.data.type === 'income' ? [
      { journalEntryId: createdEntry.id, accountId: cashAccount.id, categoryId: category.id, direction: EntryDirection.DEBIT, amount },
      { journalEntryId: createdEntry.id, accountId: statementAccount.id, categoryId: category.id, direction: EntryDirection.CREDIT, amount }
    ] : [
      { journalEntryId: createdEntry.id, accountId: statementAccount.id, categoryId: category.id, direction: EntryDirection.DEBIT, amount },
      { journalEntryId: createdEntry.id, accountId: cashAccount.id, categoryId: category.id, direction: EntryDirection.CREDIT, amount }
    ] })
    return createdEntry
  })

  const payload = { success: true, data: { id: entry.id, amount: Number(amount), type: parsed.data.type, categoryId: category.id, description: entry.description ?? '', date: entry.transactionDate.toISOString() } }
  if (idem) idempotencyStore.set(`${userId}:${idem}`, payload)
  return res.status(201).json(payload)
}))

ledgerRouter.patch('/entries/:id', asyncHandler(async (req, res) => {
  const userId = req.authUserId!
  const parsed = createEntrySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ success: false, error: 'INVALID_INPUT', fields: parsed.error.flatten().fieldErrors })
  const existing = await prisma.journalEntry.findFirst({ where: { id: req.params.id, userId }, select: { id: true } })
  if (!existing) return res.status(404).json({ success: false, error: 'ENTRY_NOT_FOUND' })
  const updated = await prisma.journalEntry.update({ where: { id: existing.id }, data: { description: parsed.data.description, transactionDate: parsed.data.date }, select: { id: true, transactionDate: true, description: true } })
  return res.json({ success: true, data: { id: updated.id, description: updated.description ?? '', date: updated.transactionDate.toISOString() } })
}))

ledgerRouter.delete('/entries/:id', asyncHandler(async (req, res) => {
  const userId = req.authUserId!
  const existing = await prisma.journalEntry.findFirst({ where: { id: req.params.id, userId }, select: { id: true } })
  if (!existing) return res.status(404).json({ success: false, error: 'ENTRY_NOT_FOUND' })
  await prisma.journalEntry.delete({ where: { id: existing.id } })
  return res.status(204).send()
}))
