import type { NextFunction, Request, Response } from 'express'
import { sendError } from '../lib/api-response.js'
import { verifyAuthToken } from '../lib/token.js'

function parseToken(req: Request) {
  const authorization = req.header('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
}

function hydrateAuth(req: Request) {
  const token = parseToken(req)
  if (!token) return null
  const payload = verifyAuthToken(token)
  if (!payload) return null
  req.authUserId = payload.userId
  req.authPinSet = payload.pinSet
  req.authRole = payload.role
  req.user = { id: payload.userId }
  return payload
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const payload = hydrateAuth(req)
  if (!payload) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing token')
  return next()
}

export function requireAuthWithPin(req: Request, res: Response, next: NextFunction) {
  const payload = req.authUserId ? { userId: req.authUserId, pinSet: req.authPinSet, role: req.authRole } : hydrateAuth(req)
  if (!payload) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing token')
  if (!payload.pinSet) return sendError(res, 403, 'FORBIDDEN', 'PIN setup required')
  return next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const payload = req.authUserId ? { userId: req.authUserId, pinSet: req.authPinSet, role: req.authRole } : hydrateAuth(req)
  if (!payload) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing token')
  if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return sendError(res, 403, 'FORBIDDEN', 'Admin role required')
  }
  return next()
}
