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
  return next()
}
