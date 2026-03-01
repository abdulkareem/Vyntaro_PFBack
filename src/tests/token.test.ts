import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthToken, verifyAuthToken } from '../lib/token.js'

test('createAuthToken returns a JWT with expected claims', () => {
  const token = createAuthToken('user-123', true, 'ADMIN')
  const [headerEncoded, payloadEncoded, signature] = token.split('.')

  assert.ok(headerEncoded)
  assert.ok(payloadEncoded)
  assert.ok(signature)

  const header = JSON.parse(Buffer.from(headerEncoded, 'base64url').toString()) as { alg: string; typ: string }
  const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString()) as {
    sub: string
    userId: string
    iat: number
    exp: number
    pinSet: boolean
    role: string
  }

  assert.equal(header.alg, 'HS256')
  assert.equal(header.typ, 'JWT')
  assert.equal(payload.sub, 'user-123')
  assert.equal(payload.userId, 'user-123')
  assert.equal(payload.pinSet, true)
  assert.equal(payload.role, 'ADMIN')
  assert.ok(payload.exp > payload.iat)
})

test('verifyAuthToken validates and returns auth context', () => {
  const token = createAuthToken('user-456', false, 'USER')
  const verified = verifyAuthToken(token)

  assert.deepEqual(verified, {
    userId: 'user-456',
    pinSet: false,
    role: 'USER'
  })
})
