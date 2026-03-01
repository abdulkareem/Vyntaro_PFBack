# Auth API Contract

All auth endpoints are rooted at `/api/auth`.

## Endpoint matrix

| Endpoint | Method | Purpose |
|---|---|---|
| `/identity/check` | `POST` | Check whether phone/email identity exists |
| `/register/start` | `POST` | Start registration and OTP send |
| `/register/otp/verify` | `POST` | Verify registration OTP and return `otpSessionId` for PIN setup |
| `/pin/set` | `POST` | Set/replace PIN using verified OTP session |
| `/login` | `POST` | Login and issue token |
| `/pin/reset/start` | `POST` | Start PIN reset OTP flow |
| `/pin/reset/otp/verify` | `POST` | Verify reset OTP and return `otpSessionId` for PIN setup |
| `/otp/resend` | `POST` | Resend OTP and recover OTP session for `register` or `reset` mode |

## Request schemas

### OTP verify
```json
{
  "phone": "+911234567890",
  "otp": "123456"
}
```

### Set PIN
```json
{
  "pin": "1234",
  "mode": "register",
  "otpSessionId": "otp_session_id_from_verify_response"
}
```

`otpSessionId` can be sent either in request body or as header:

`x-otp-session-id: <otpSessionId from otp verify>`


### OTP resend
```json
{
  "phone": "+911234567890",
  "mode": "register"
}
```

`mode` is required and must be either `register` or `reset`.

Success:
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "next": "verify-otp",
  "otpSessionId": "<new-otp-session-id>"
}
```

## OTP verify response contract

Both OTP verify endpoints (`/register/otp/verify` and `/pin/reset/otp/verify`) return:

```json
{
  "success": true,
  "next": "set-pin",
  "userId": "<user-id>",
  "otpSessionId": "<otp-session-id>"
}
```

## PIN set error contract

If OTP session context is missing/invalid/expired/consumed:

```json
{
  "success": false,
  "code": "OTP_SESSION_REQUIRED",
  "message": "OTP verification is required before setting a PIN"
}
```

## Notes

- OTP verification returns `OTP_LIMIT_EXCEEDED` when attempts are exhausted.
- `/otp/resend` always creates a fresh OTP session (attempts reset to `3`) for the requested mode and invalidates previous active sessions for that mode.
- OTP sessions are consumed immediately after a successful PIN set and cannot be reused.
- `devOtp` is only present in non-production environments on start endpoints.


## Login request/response contract

Endpoint: `POST /api/auth/login`

Request:
```json
{
  "phone": "+911234567890",
  "pin": "1234"
}
```

or

```json
{
  "email": "user@example.com",
  "pin": "1234"
}
```

Success (`200`):
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": "<user-id>",
    "phone": "+911234567890",
    "email": "user@example.com"
  }
}
```

Invalid PIN (`401`):
```json
{
  "success": false,
  "code": "INVALID_PIN",
  "message": "Invalid PIN"
}
```

User not found (`401`):
```json
{
  "success": false,
  "code": "USER_NOT_FOUND"
}
```

`/api/auth/login` always resolves on the auth router and does not return `404` for auth failures.
