import assert from 'node:assert/strict'
import test from 'node:test'
import { app } from '../server.js'

function createServer() {
  return new Promise<import('node:http').Server>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('auth login validation returns standardized error shape', async () => {
  const server = await createServer()
  const port = (server.address() as any).port
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(typeof body.error.code, 'string')
  assert.equal(typeof body.error.message, 'string')
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

test('auth otp verify rate limits', async () => {
  const server = await createServer()
  const port = (server.address() as any).port
  let status = 0
  for (let i = 0; i < 9; i++) {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/otp/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '+15550000001', otp: '111111' }) })
    status = response.status
  }
  assert.equal(status, 429)
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})


test('reset pin otp verify endpoint is mounted on expected path', async () => {
  const server = await createServer()
  const port = (server.address() as any).port
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/pin/reset/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  })
  assert.notEqual(response.status, 404)
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'INVALID_INPUT')
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})
