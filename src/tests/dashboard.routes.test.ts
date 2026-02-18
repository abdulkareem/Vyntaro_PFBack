import assert from 'node:assert/strict'
import test from 'node:test'
import { app } from '../server.js'
import { createAuthToken } from '../lib/token.js'

function createServer() {
  return new Promise<import('node:http').Server>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('dashboard endpoint requires auth', async () => {
  const server = await createServer()
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard/net-worth?month=1&year=2025`)
  assert.equal(response.status, 401)

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

test('dashboard endpoint validates month/year', async () => {
  const server = await createServer()
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  const token = createAuthToken('test-user-id')
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard/net-worth?month=13&year=2025`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  assert.equal(response.status, 400)

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})
