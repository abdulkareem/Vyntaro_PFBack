# Dashboard API cURL examples

```bash
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/summary?month=2026-01"
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/financial-health?month=01&year=2026"
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/net-worth?month=01&year=2026"
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/expense-breakdown?month=01&year=2026"
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/alerts?month=01&year=2026"
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/prediction?month=01&year=2026"
curl -H "Authorization: Bearer <JWT>" "http://localhost:8080/api/dashboard/lending-summary?month=01&year=2026"
```
