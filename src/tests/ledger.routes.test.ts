import assert from 'node:assert/strict'
import test from 'node:test'
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
  const original = prisma.category.findMany
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
  prisma.category.findMany = original
})
