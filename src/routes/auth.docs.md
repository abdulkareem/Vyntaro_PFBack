# Auth API Contract

All auth endpoints are rooted at `/api/auth`.

## Endpoint matrix

| Endpoint | Method | Purpose |
|---|---|---|
| `/identity/check` | `POST` | Check whether phone identity exists, is verified, and whether PIN is set |
| `/register/start` | `POST` | Start registration and OTP send |
| `/register` | `POST` | Alias of `/register/start` |
| `/otp/send` | `POST` | Alias of `/register/start` |
| `/register/verify` | `POST` | Verify registration OTP |
| `/otp/verify` | `POST` | Alias of `/register/verify` |
| `/pin/set` | `POST` | Set/replace PIN |
| `/set-pin` | `POST` | Alias of `/pin/set` |
| `/login` | `POST` | Login and issue token |
| `/reset-pin/start` | `POST` | Start PIN reset OTP flow |
| `/forgot-pin/start` | `POST` | Alias of `/reset-pin/start` |
| `/forgot-password/start` | `POST` | Alias of `/reset-pin/start` |
| `/reset-pin/complete` | `POST` | Complete PIN reset with OTP |
| `/forgot-pin/complete` | `POST` | Alias of `/reset-pin/complete` |
| `/forgot-password/complete` | `POST` | Alias of `/reset-pin/complete` |

## Request schemas

### Phone only
```json
{ "phone": "+911234567890" }
```

### Registration/OTP send
```json
{
  "phone": "+911234567890",
  "email": "optional@example.com",
  "country": "IN",
  "region": "KA"
}
```

### OTP verify
```json
{
  "phone": "+911234567890",
  "otp": "123456"
}
```

### Set PIN / Login
```json
{
  "phone": "+911234567890",
  "pin": "1234"
}
```

### Reset PIN complete
```json
{
  "phone": "+911234567890",
  "otp": "123456",
  "pin": "4321"
}
```

## Response conventions

### Success (`200`)
All successful auth endpoints return:

```json
{ "ok": true }
```

and may include endpoint-specific fields (`user`, `token`, `next`, `delivery`, `devOtp`).

### Validation failure (`400`)
```json
{
  "ok": false,
  "error": {
    "formErrors": [],
    "fieldErrors": { "phone": ["Invalid phone"] }
  }
}
```

### Business failures
- `401` → `invalid_credentials`
- `403` → `pin_not_set`, `not_verified`
- `404` → `not_found`
- `410` → `otp_expired`
- `429` → `otp_attempt_limit_reached`

Example:
```json
{ "ok": false, "reason": "invalid_otp" }
```

## Notes

- OTP delivery metadata is explicit in responses:
  ```json
  {
    "delivery": {
      "sms": "sent",
      "email": "sent | skipped | failed",
      "whatsapp": "sent | skipped | failed"
    }
  }
  ```
- `devOtp` is only present in non-production environments.
