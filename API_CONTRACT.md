# Backend API Contract (Auth, Profile, Dashboard, Admin)

Base URL prefix: `/api`

## Error shape (all endpoints)

```json
{
  "ok": false,
  "error": {
    "code": "MACHINE_CODE",
    "message": "Human-readable message"
  }
}
```

## Auth endpoints

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/identity/check`
- `POST /api/auth/register/start`
- `POST /api/auth/register/verify`
- `POST /api/auth/otp/request`
- `POST /api/auth/otp/resend`
- `POST /api/auth/otp/verify`
- `POST /api/auth/pin/set`
- `POST /api/auth/pin/set-with-mode`
- `POST /api/auth/pin/reset/start`
- `POST /api/auth/pin/reset/verify`
- `POST /api/auth/pin/reset/complete`
- `POST /api/auth/pin/change`
- `POST /api/auth/profile/update`

Login and refresh return:

```json
{
  "ok": true,
  "user": { "id": "", "phone": "", "email": "", "verifiedAt": null, "avatarUrl": null, "pinSet": true, "role": "USER" },
  "accessToken": "",
  "refreshToken": "",
  "expiresAt": "",
  "next": "dashboard"
}
```

## Admin endpoints (RBAC)

All `/api/admin/*` routes require admin token role (`ADMIN` or `SUPER_ADMIN`).

- `POST /api/admin/login`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `PATCH /api/admin/users/:userId/reset-pin`
- `DELETE /api/admin/users/:userId`
- `GET /api/admin/tables`
- `PUT /api/admin/settings`

## Dashboard endpoints

- `GET /api/dashboard/financial-health`
- `GET /api/dashboard/net-worth`
- `GET /api/dashboard/expense-breakdown`
- `GET /api/dashboard/alerts`
- `GET /api/dashboard/prediction`
- `GET /api/dashboard/lending-summary`

All dashboard endpoints accept `month` and `year` query params, require auth + pin, and include cache headers.
