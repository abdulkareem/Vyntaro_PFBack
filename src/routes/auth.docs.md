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
| `/otp/resend` | `POST` | Resend OTP after max attempts reached |

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

- OTP sessions are consumed immediately after a successful PIN set and cannot be reused.
- `devOtp` is only present in non-production environments on start endpoints.
