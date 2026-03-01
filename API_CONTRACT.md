# Backend API Contract (Authentication State Machine)

Base URL prefix: `/api`

## Auth endpoints

All endpoints below are under `/api/auth`.

| Endpoint | Method | Request body | Success response |
|---|---|---|---|
| `/register/start` | `POST` | `{ country?, phone?, email? }` | `{ success: true, next: "verify-otp", userId }` |
| `/register/otp/verify` | `POST` | `{ phone?/email?, otp }` | `{ success: true, next: "set-pin", userId }` |
| `/pin/set` | `POST` | `{ pin, mode }` + header `x-otp-session-id` | `{ success: true, next: "login" }` |
| `/login` | `POST` | `{ phone?/email?, pin }` | `{ success: true, token }` |
| `/pin/reset/start` | `POST` | `{ country?, phone?/email? }` | `{ success: true, next: "verify-otp", userId }` |
| `/pin/reset/otp/verify` | `POST` | `{ phone?/email?, otp }` | `{ success: true, next: "set-pin", userId }` |
| `/otp/resend` | `POST` | `{ phone?/email? }` | `{ success: true }` |

## Error contract

All user mistakes return explicit structured errors:

```json
{
  "success": false,
  "code": "INVALID_OTP | OTP_EXPIRED | OTP_LIMIT_EXCEEDED | INVALID_PIN | USER_NOT_FOUND | ...",
  "message": "Human readable error"
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
