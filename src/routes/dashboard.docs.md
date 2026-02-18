# Dashboard Insights API

All routes require `Authorization: Bearer <token>` and query parameters `month` (1-12), `year`.

- `GET /api/dashboard/financial-health` (alias: `/api/dashboard/health-score`)
  - Response: `{ score: number, label: "Good" | "Average" | "Risky" }`

- `GET /api/dashboard/net-worth`
  - Response: `{ netWorth: number, savingsThisMonth: number }`

- `GET /api/dashboard/expense-breakdown`
  - Response: `{ category: string, amount: number }[]`

- `GET /api/dashboard/alerts`
  - Response: `{ type: "warning" | "info" | "success", message: string }[]`

- `GET /api/dashboard/prediction`
  - Response: `{ projectedBalance: number }`

- `GET /api/dashboard/lending-summary`
  - Response:
    ```json
    {
      "totalLent": 0,
      "totalLoan": 0,
      "breakdown": [
        {
          "person": "Alice",
          "amount": 12000,
          "kind": "lent",
          "overdue": false,
          "dueDate": "2026-02-28T00:00:00.000Z"
        }
      ],
      "agingBuckets": [
        { "bucket": "0-30", "count": 1, "amount": 3000 },
        { "bucket": "31-60", "count": 0, "amount": 0 },
        { "bucket": "61-90", "count": 0, "amount": 0 },
        { "bucket": "90+", "count": 0, "amount": 0 }
      ]
    }
    ```
