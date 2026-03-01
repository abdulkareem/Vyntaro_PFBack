import type { RequestHandler } from 'express'
import { sendError } from '../lib/api-response.js'

type WindowConfig = { windowMs: number; max: number }

const buckets = new Map<string, { count: number; expiresAt: number }>()

function clientKey(req: Parameters<RequestHandler>[0], key: string) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  return `${key}:${ip}`
}

export function rateLimit(key: string, config: WindowConfig): RequestHandler {
  return (req, res, next) => {
    const id = clientKey(req, key)
    const now = Date.now()
    const entry = buckets.get(id)

    if (!entry || entry.expiresAt <= now) {
      buckets.set(id, { count: 1, expiresAt: now + config.windowMs })
      return next()
    }

    if (entry.count >= config.max) {
      return sendError(res, 429, 'THROTTLED', 'Too many requests, please try again later')
    }

    entry.count += 1
    buckets.set(id, entry)
    return next()
  }
}
