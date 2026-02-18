import assert from 'node:assert/strict'
import test from 'node:test'
import { computeFinancialHealthScore, getAgingBucket } from '../services/dashboard/dashboard.logic.js'

test('financial health maps to Good', () => {
  const result = computeFinancialHealthScore({
    income: 100000,
    expense: 35000,
    lendingExposure: 10000,
    budgetUtilization: 0.5
  })

  assert.equal(result.label, 'Good')
  assert.ok(result.score >= 70)
})

test('financial health maps to Risky for weak cashflow', () => {
  const result = computeFinancialHealthScore({
    income: 50000,
    expense: 70000,
    lendingExposure: 80000,
    budgetUtilization: 1.2
  })

  assert.equal(result.label, 'Risky')
  assert.ok(result.score < 45)
})

test('aging bucket boundaries', () => {
  assert.equal(getAgingBucket(10), '0-30')
  assert.equal(getAgingBucket(45), '31-60')
  assert.equal(getAgingBucket(75), '61-90')
  assert.equal(getAgingBucket(91), '90+')
})
