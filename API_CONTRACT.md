# Backend API Contract (Production Ready)

Base URL prefix: `/api`

## Infrastructure

| Endpoint | Method | Body | Success | Status codes |
|---|---|---|---|---|
| `/health` | `GET` | none | `{ "ok": true }` | `200` |

## Auth

All endpoints below are under `/api/auth`.

| Endpoint | Method | Request body | Success response | Errors |
|---|---|---|---|---|
| `/identity/check` | `POST` | `{ phone }` | `{ ok, exists, verified, pinSet, next, user? }` | `400` validation |
| `/register/start` | `POST` | `{ phone, email?, country?, region? }` | `{ ok, userId?, user, delivery?, next, devOtp? }` | `400` validation |
| `/register` | `POST` | same as above | alias of `/register/start` | same |
| `/otp/send` | `POST` | same as above | alias of `/register/start` | same |
| `/register/verify` | `POST` | `{ phone, otp }` | `{ ok: true, user, next }` | `400` invalid OTP/validation, `404`, `410`, `429` |
| `/otp/verify` | `POST` | `{ phone, otp }` | alias of `/register/verify` | same |
| `/pin/set` | `POST` | `{ phone, pin }` | `{ ok: true }` | `400` validation, `403` |
| `/set-pin` | `POST` | `{ phone, pin }` | alias of `/pin/set` | same |
| `/login` | `POST` | `{ phone, pin }` | `{ ok: true, user, token, next }` | `400` validation, `401`, `403` |
| `/reset-pin/start` | `POST` | `{ phone }` | `{ ok: true, delivery, devOtp? }` | `400`, `403` |
| `/forgot-pin/start` | `POST` | `{ phone }` | alias of `/reset-pin/start` | same |
| `/forgot-password/start` | `POST` | `{ phone }` | alias of `/reset-pin/start` | same |
| `/reset-pin/complete` | `POST` | `{ phone, otp, pin }` | `{ ok: true }` | `400`, `403`, `410`, `429` |
| `/forgot-pin/complete` | `POST` | `{ phone, otp, pin }` | alias of `/reset-pin/complete` | same |
| `/forgot-password/complete` | `POST` | `{ phone, otp, pin }` | alias of `/reset-pin/complete` | same |

## Dashboard

All endpoints below are under `/api/dashboard` and require `Authorization: Bearer <token>`.

| Endpoint | Method | Query | Success response |
|---|---|---|---|
| `/financial-health` | `GET` | `month`, `year` | Financial health payload |
| `/health-score` | `GET` | `month`, `year` | alias of `/financial-health` |
| `/net-worth` | `GET` | `month`, `year` | Net worth payload |
| `/expense-breakdown` | `GET` | `month`, `year` | Category-wise expense payload |
| `/alerts` | `GET` | `month`, `year` | Dashboard alerts payload |
| `/prediction` | `GET` | `month`, `year` | Monthly prediction payload |
| `/lending-summary` | `GET` | `month`, `year` | Lending summary payload |

Validation failures return `400`.
Authentication failures return `401`/`403`.

## Global response rules

- `200` / `201` for success (this backend currently uses `200` for auth + dashboard actions).
- `400` for validation and contract mismatch.
- `401` / `403` for authentication/authorization and account state failures.
- `404` only for missing routes.
- `500` only for unexpected server faults.
