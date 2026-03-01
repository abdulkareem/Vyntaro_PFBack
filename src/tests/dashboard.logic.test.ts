import assert from 'node:assert/strict'
import test from 'node:test'
import { computeFinancialHealthScore } from '../services/dashboard/dashboard.logic.js'
import { computeBalance, computeBudgetUsage } from '../services/dashboard/dashboard.service.js'

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

test('computes balance from income and expense', () => {
  assert.equal(computeBalance(5000, 3400), 1600)
  assert.equal(computeBalance(0, 0), 0)
})

test('budget usage clamps between 0 and 1', () => {
  assert.equal(computeBudgetUsage(50, 100), 0.5)
  assert.equal(computeBudgetUsage(200, 100), 1)
  assert.equal(computeBudgetUsage(0, 0), 0)
})
