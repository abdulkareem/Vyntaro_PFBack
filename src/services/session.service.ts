import crypto from 'node:crypto'

type Session = { userId: string; expiresAt: number; revoked: boolean }
const sessions = new Map<string, Session>()
const TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS ?? 1000 * 60 * 60 * 24 * 30)

function tokenValue() {
  return crypto.randomBytes(32).toString('hex')
}

export function issueRefreshToken(userId: string) {
  const token = tokenValue()
  sessions.set(token, { userId, expiresAt: Date.now() + TTL_MS, revoked: false })
  return token
}

export function rotateRefreshToken(currentToken: string) {
  const current = sessions.get(currentToken)
  if (!current || current.revoked || current.expiresAt < Date.now()) return null
  current.revoked = true
  sessions.set(currentToken, current)
  return { userId: current.userId, refreshToken: issueRefreshToken(current.userId) }
}

export function revokeUserRefreshTokens(userId: string) {
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) {
      session.revoked = true
      sessions.set(token, session)
    }
  }
}
