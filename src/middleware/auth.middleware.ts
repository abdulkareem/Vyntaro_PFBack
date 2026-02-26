import type { NextFunction, Request, Response } from 'express'
import { verifyAuthToken } from '../lib/token.js'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const payload = verifyAuthToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  req.authUserId = payload.userId
  req.authPinSet = payload.pinSet
  req.authRole = payload.role
  return next()
}

export async function requireAuthWithPin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUserId || req.authPinSet === undefined) {
    const authorization = req.header('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const payload = verifyAuthToken(token)
    if (!payload) return res.status(401).json({ error: 'unauthorized' })
    req.authUserId = payload.userId
    req.authPinSet = payload.pinSet
    req.authRole = payload.role
  }

  if (!req.authPinSet) {
    return res.status(403).json({ error: 'pin_required' })
  }

  return next()
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUserId || !req.authRole) {
    const authorization = req.header('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const payload = verifyAuthToken(token)
    if (!payload) return res.status(401).json({ error: 'unauthorized' })
    req.authUserId = payload.userId
    req.authPinSet = payload.pinSet
    req.authRole = payload.role
  }

  if (req.authRole !== 'ADMIN' && req.authRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'forbidden' })
  }

  return next()
}
