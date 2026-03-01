import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id')
  const requestId = incoming?.trim() || crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
}

export function logSecurityEvent(event: string, req: Request, metadata: Record<string, unknown> = {}) {
  const payload = {
    event,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    userId: req.authUserId,
    role: req.authRole,
    ...metadata
  }

  console.info(JSON.stringify(payload))
}
