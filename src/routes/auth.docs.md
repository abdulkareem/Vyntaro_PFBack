# Auth API Contract

## `POST /api/auth/register`
Request body:
```json
{
  "phone": "+911234567890",
  "email": "optional@example.com"
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
  "next": "/set-pin"
}
```

Error (`400`):
```json
{ "error": { "formErrors": [], "fieldErrors": { "phone": ["Invalid"] } } }
```

## `POST /api/auth/set-pin`
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

Error (`400`):
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
    "verifiedAt": "2026-01-01T00:00:00.000Z",
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
