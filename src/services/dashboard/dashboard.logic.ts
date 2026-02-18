import type { LendingAgingBucket } from './dashboard.types.js'

export function computeFinancialHealthScore(input: {
  income: number
  expense: number
  lendingExposure: number
  budgetUtilization: number
}): { score: number; label: 'Good' | 'Average' | 'Risky' } {
  const expenseIncomeRatio = input.income > 0 ? input.expense / input.income : input.expense > 0 ? 1.5 : 0
  const savingsRate = input.income > 0 ? clamp((input.income - input.expense) / input.income, -1, 1) : 0
  const exposureRatio = input.income > 0 ? input.lendingExposure / input.income : 1

  const ratioScore = clamp((1 - expenseIncomeRatio) * 40, 0, 40)
  const savingsScore = clamp((savingsRate + 1) * 15, 0, 30)
  const exposureScore = clamp((1 - exposureRatio) * 20, 0, 20)
  const budgetScore = clamp((1 - input.budgetUtilization) * 10, 0, 10)

  const score = Math.round(clamp(ratioScore + savingsScore + exposureScore + budgetScore, 0, 100))
  const label = score >= 70 ? 'Good' : score >= 45 ? 'Average' : 'Risky'

  return { score, label }
}

export function getAgingBucket(daysOverdue: number): LendingAgingBucket['bucket'] {
  if (daysOverdue <= 30) return '0-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
