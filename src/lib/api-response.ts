import type { Response } from 'express'

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_PIN'
  | 'ACCOUNT_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_LIMIT_EXCEEDED'
  | 'OTP_SESSION_REQUIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ROUTE_NOT_FOUND'
  | 'CONFLICT'
  | 'USER_EXISTS'
  | 'PIN_FORMAT_INVALID'
  | 'THROTTLED'
  | 'INTERNAL_SERVER_ERROR'

export function sendError(res: Response, status: number, code: ApiErrorCode, message: string) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message
    }
  })
}

export function sendOk<T>(res: Response, data: T) {
  return res.json({ ok: true, ...data })
}
