import assert from 'node:assert/strict'
import test from 'node:test'
import { AccountType, CategoryKind } from '@prisma/client'
import { app } from '../server.js'
import { createAuthToken } from '../lib/token.js'
import { prisma } from '../lib/prisma.js'

function createServer() {
  return new Promise<import('node:http').Server>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('ledger categories endpoint requires auth', async () => {
  const server = await createServer()
  const port = (server.address() as any).port

  const response = await fetch(`http://127.0.0.1:${port}/api/ledger/categories`)

  assert.equal(response.status, 401)

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

test('ledger categories returns empty array when no categories exist', async () => {
  const originalCount = prisma.category.count
  const originalCreateMany = prisma.category.createMany
  const originalFindMany = prisma.category.findMany

  prisma.category.count = (async () => 0) as typeof prisma.category.count
  prisma.category.createMany = (async () => ({ count: 0 })) as unknown as typeof prisma.category.createMany
  prisma.category.findMany = (async () => []) as typeof prisma.category.findMany

  const server = await createServer()
  const port = (server.address() as any).port
  const token = createAuthToken('user-123')

  const response = await fetch(`http://127.0.0.1:${port}/api/ledger/categories`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, { success: true, data: [] })

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  prisma.category.count = originalCount
  prisma.category.createMany = originalCreateMany
  prisma.category.findMany = originalFindMany
})

test('ledger categories can be created for authenticated user', async () => {
  const originalFindUnique = prisma.category.findUnique
  const originalCreate = prisma.category.create

  prisma.category.findUnique = (async () => null) as unknown as typeof prisma.category.findUnique
  prisma.category.create =
    (async () => ({ id: 'cat-1', name: 'Bills', kind: CategoryKind.EXPENSE })) as unknown as typeof prisma.category.create

  const server = await createServer()
  const port = (server.address() as any).port
  const token = createAuthToken('user-123')

  const response = await fetch(`http://127.0.0.1:${port}/api/ledger/categories`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bills', type: 'expense' })
  })

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.deepEqual(body, {
    success: true,
    data: { id: 'cat-1', name: 'Bills', type: 'expense' }
  })

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  prisma.category.findUnique = originalFindUnique
  prisma.category.create = originalCreate
})

test('ledger entries returns empty array when no entries exist', async () => {
  const originalFindMany = prisma.journalEntry.findMany
  prisma.journalEntry.findMany = (async () => []) as typeof prisma.journalEntry.findMany

  const server = await createServer()
  const port = (server.address() as any).port
  const token = createAuthToken('user-123')

  const response = await fetch(`http://127.0.0.1:${port}/api/ledger/entries`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, { success: true, data: [] })

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  prisma.journalEntry.findMany = originalFindMany
})

test('ledger entries can be created with scoped category ownership', async () => {
  const originalFindFirstCategory = prisma.category.findFirst
  const originalFindFirstAccount = prisma.financialAccount.findFirst
  const originalCreateAccount = prisma.financialAccount.create
  const originalTransaction = prisma.$transaction

  prisma.category.findFirst =
    (async () => ({ id: 'cat-1', kind: CategoryKind.EXPENSE })) as typeof prisma.category.findFirst
  prisma.financialAccount.findFirst = (async (args?: unknown) => {
    const accountType = (args as { where?: { accountType?: AccountType } } | undefined)?.where?.accountType
    if (accountType === AccountType.ASSET) return { id: 'asset-1' }
    return { id: 'expense-1' }
  }) as typeof prisma.financialAccount.findFirst
  prisma.financialAccount.create = (async () => ({ id: 'created-account' })) as unknown as typeof prisma.financialAccount.create
  prisma.$transaction = (async (callback: any) =>
    callback({
      journalEntry: {
        create: async () => ({
          id: 'entry-1',
          transactionDate: new Date('2026-03-01T00:00:00.000Z'),
          description: 'Lunch'
        })
      },
      journalLine: {
        createMany: async () => ({ count: 2 })
      }
    })) as typeof prisma.$transaction

  const server = await createServer()
  const port = (server.address() as any).port
  const token = createAuthToken('user-123')

  const response = await fetch(`http://127.0.0.1:${port}/api/ledger/entries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 250,
      type: 'expense',
      categoryId: 'cat-1',
      description: 'Lunch',
      date: '2026-03-01T00:00:00.000Z'
    })
  })

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.deepEqual(body, {
    success: true,
    data: {
      id: 'entry-1',
      amount: 250,
      type: 'expense',
      categoryId: 'cat-1',
      description: 'Lunch',
      date: '2026-03-01T00:00:00.000Z'
    }
  })

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  prisma.category.findFirst = originalFindFirstCategory
  prisma.financialAccount.findFirst = originalFindFirstAccount
  prisma.financialAccount.create = originalCreateAccount
  prisma.$transaction = originalTransaction
})
