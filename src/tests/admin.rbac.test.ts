import assert from 'node:assert/strict'
import test from 'node:test'
import { app } from '../server.js'
import { createAuthToken } from '../lib/token.js'

function createServer() {
  return new Promise<import('node:http').Server>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('admin routes block non-admin roles', async () => {
  const server = await createServer()
  const port = (server.address() as any).port
  const token = createAuthToken('u1', true, 'USER')

  const response = await fetch(`http://127.0.0.1:${port}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 403)
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'FORBIDDEN')

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})
