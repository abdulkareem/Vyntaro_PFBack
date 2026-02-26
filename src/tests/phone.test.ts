import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePhone, phoneSchema } from '../lib/phone.js'

test('normalizePhone strips formatting and leading plus', () => {
  assert.equal(normalizePhone('+91 (987) 654-3210'), '919876543210')
})

test('phoneSchema accepts common formatted numbers', () => {
  const parsed = phoneSchema.safeParse('+91 (987) 654-3210')
  assert.equal(parsed.success, true)
})

test('phoneSchema rejects non-numeric input', () => {
  const parsed = phoneSchema.safeParse('+91-ABC-3210')
  assert.equal(parsed.success, false)
})
