# Backend API Contract (Authentication State Machine)

Base URL prefix: `/api`

## Auth endpoints

All endpoints below are under `/api/auth`.

| Endpoint | Method | Request body | Success response |
|---|---|---|---|
| `/register/start` | `POST` | `{ country?, phone?, email? }` | `{ success: true, next: "verify-otp", userId, otpSessionId }` |
| `/register/otp/verify` | `POST` | `{ phone?/email?, otp }` | `{ success: true, next: "set-pin", userId, otpSessionId }` |
| `/pin/set` | `POST` | `{ pin, mode, otpSessionId? }` and/or header `x-otp-session-id` | `{ success: true, next: "login" }` |
| `/login` | `POST` | `{ phone?/email?, pin }` | `{ success: true, token }` |
| `/pin/reset/start` | `POST` | `{ country?, phone?/email? }` | `{ success: true, next: "verify-otp", userId, otpSessionId }` |
| `/pin/reset/otp/verify` | `POST` | `{ phone?/email?, otp }` | `{ success: true, next: "set-pin", userId, otpSessionId }` |
| `/otp/resend` | `POST` | `{ phone?/email? }` | `{ success: true, otpSessionId }` |

## OTP session contract for frontend

1. Call OTP verify endpoint and store `otpSessionId` from response.
2. Call `/api/auth/pin/set` with:
   - `pin`
   - `mode` (`register` or `reset`)
   - `otpSessionId` in body **or** `x-otp-session-id` header.
3. Handle `403` error with code `OTP_SESSION_REQUIRED` by restarting OTP verification.

### OTP session validation enforced in `/pin/set`

`otpSessionId` must point to a session that is:
- present,
- for the correct purpose (`REGISTER` / `PIN_RESET`),
- OTP-verified (via auth state/flow flags),
- not expired,
- not already consumed.

After successful PIN set, the OTP session is consumed and cannot be reused.

## Error contract

All user mistakes return explicit structured errors:

```json
{
  "success": false,
  "code": "INVALID_OTP | OTP_EXPIRED | OTP_LIMIT_EXCEEDED | OTP_SESSION_REQUIRED | INVALID_PIN | USER_NOT_FOUND | ...",
  "message": "Human readable error"
}
```

Example when OTP verification context is missing/invalid:

```json
{
  "success": false,
  "code": "OTP_SESSION_REQUIRED",
  "message": "OTP verification is required before setting a PIN"
}
```

## Authentication state machine

States:
- `IDENTITY_VERIFIED`
- `OTP_VERIFIED`
- `PIN_SET`
- `ACTIVE`

Transitions:
1. Register start creates user at `IDENTITY_VERIFIED`.
2. Register OTP verification moves user to `OTP_VERIFIED`.
3. PIN setup moves user to `PIN_SET`.
4. Successful login moves user to `ACTIVE`.

Each transition is persisted in `AuthStateTransition`.
