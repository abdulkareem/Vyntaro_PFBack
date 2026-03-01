import crypto from 'node:crypto'

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET ?? 'dev-secret'
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7)

type TokenPayload = {
  sub: string
  userId: string
  iat: number
  exp: number
  pinSet: boolean
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString()
}

function sign(data: string): string {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url')
}

function parsePayload(payloadEncoded: string): TokenPayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(payloadEncoded)) as Partial<TokenPayload>
    if (!parsed.sub || !parsed.userId || !parsed.exp || !parsed.iat) return null
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    if (typeof parsed.pinSet !== 'boolean') return null
    if (!parsed.role) return null

    return {
      sub: parsed.sub,
      userId: parsed.userId,
      iat: parsed.iat,
      exp: parsed.exp,
      pinSet: parsed.pinSet,
      role: parsed.role
    }
  } catch {
    return null
  }
}

export function createAuthToken(userId: string, pinSet = true, role: TokenPayload['role'] = 'USER'): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload: TokenPayload = {
    sub: userId,
    userId,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS,
    pinSet,
    role
  }

  const headerEncoded = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadEncoded = toBase64Url(JSON.stringify(payload))
  const signature = sign(`${headerEncoded}.${payloadEncoded}`)
  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

export function verifyAuthToken(token: string): { userId: string; pinSet: boolean; role: TokenPayload['role'] } | null {
  const parts = token.split('.')

  const payloadAndSignature =
    parts.length === 3 ? { payloadEncoded: parts[1], signature: parts[2], signedData: `${parts[0]}.${parts[1]}` } : null

  const legacyPayloadAndSignature =
    parts.length === 2 ? { payloadEncoded: parts[0], signature: parts[1], signedData: parts[0] } : null

  const tokenParts = payloadAndSignature ?? legacyPayloadAndSignature
  if (!tokenParts) return null

  const expected = sign(tokenParts.signedData)
  const signatureBuffer = Buffer.from(tokenParts.signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  const parsed = parsePayload(tokenParts.payloadEncoded)
  if (!parsed) return null

  return { userId: parsed.userId, pinSet: parsed.pinSet, role: parsed.role }
}
