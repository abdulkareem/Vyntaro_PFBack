# Auth API Contract

All auth endpoints are rooted at `/api/auth`.

## `POST /api/auth/register` / `POST /api/auth/register/start`
Creates a user shell (if needed), generates OTP, and sends it through configured channels.

Request body:
```json
{
  "phone": "+911234567890",
  "email": "optional@example.com",
  "country": "IN",
  "region": "KA"
}
```

Success (`200`):
```json
{
  "ok": true,
  "userId": "cuid",
  "user": {
    "id": "cuid",
    "phone": "+911234567890",
    "email": "optional@example.com",
    "pinSet": false,
    "role": "USER"
  },
  "next": "/verify-otp",
  "devOtp": {
    "otp": "123456"
  }
}
```

Notes:
- `devOtp` is omitted in production.
- If user already exists and is verified, `next` becomes `/login` or `/set-pin`.

## `POST /api/auth/register/verify`
Verifies OTP for registration.

Request body:
```json
{
  "phone": "+911234567890",
  "otp": "123456"
}
```

Success (`200`):
```json
{
  "ok": true,
  "user": {
    "id": "cuid",
    "phone": "+911234567890",
    "email": "optional@example.com"
  },
  "next": "/dashboard"
}
```

Errors:
- `400`: invalid payload / invalid OTP
- `404`: user not found
- `410`: OTP expired
- `429`: too many attempts

## `POST /api/auth/set-pin` / `POST /api/auth/pin/set`
Request body:
```json
{
  "phone": "+911234567890",
  "pin": "1234"
}
```

Success (`200`):
```json
{ "ok": true }
```

Error (`403`):
```json
{ "ok": false, "reason": "not_verified" }
```

## `POST /api/auth/login`
Request body:
```json
{
  "phone": "+911234567890",
  "pin": "1234"
}
```

Success (`200`):
```json
{
  "ok": true,
  "user": {
    "id": "cuid",
    "phone": "+911234567890",
    "email": "optional@example.com",
    "pinSet": true,
    "role": "USER"
  },
  "token": "signed-token",
  "next": "/dashboard"
}
```

Errors:
- `401`: `{ "ok": false, "reason": "invalid_credentials" }`
- `403`: `{ "ok": false, "reason": "pin_not_set" }`

## `POST /api/auth/reset-pin/start`
Request body:
```json
{
  "phone": "+911234567890"
}
```

Success (`200`):
```json
{
  "ok": true,
  "devOtp": {
    "otp": "123456"
  }
}
```

Error (`403`):
```json
{ "ok": false, "reason": "not_verified" }
```

## `POST /api/auth/reset-pin/complete`
Request body:
```json
{
  "phone": "+911234567890",
  "otp": "123456",
  "pin": "4321"
}
```

Success (`200`):
```json
{ "ok": true }
```

Errors:
- `400`: invalid payload / invalid OTP
- `403`: not verified
- `410`: OTP expired
- `429`: too many attempts
