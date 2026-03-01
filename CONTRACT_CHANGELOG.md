# Contract Changelog

## 2026-03-01

- Standardized API errors for all routes to `{ ok: false, error: { code, message } }` with stable machine codes and HTTP status mapping.
- Added auth/session endpoints for login, refresh, identity checks, OTP request/resend/verify, register verify, profile update, and full PIN lifecycle.
- Login and refresh now return a token envelope: `ok`, `user`, `accessToken`, `refreshToken`, `expiresAt`, and `next`.
- Added strict admin RBAC middleware for all `/api/admin/*` routes; only `ADMIN` and `SUPER_ADMIN` are authorized.
- Added in-memory refresh token rotation and invalidation on PIN security events.
- Added rate limiting for login, OTP send/verify, and PIN reset flows.
- Added request ID propagation (`x-request-id`) and structured logging for critical admin actions.
- Added cache-control headers and graceful default responses for dashboard aggregate read endpoints.
