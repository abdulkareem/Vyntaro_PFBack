import crypto from 'node:crypto'

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET ?? 'dev-secret'
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7)

type TokenPayload = {
  sub: string
  exp: number
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function sign(data: string): string {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url')
}

export function createAuthToken(userId: string): string {
  const payload: TokenPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  }

  const payloadEncoded = toBase64Url(JSON.stringify(payload))
  const signature = sign(payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export function verifyAuthToken(token: string): { userId: string } | null {
  const [payloadEncoded, signature] = token.split('.')
  if (!payloadEncoded || !signature) return null

  const expected = sign(payloadEncoded)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString()) as TokenPayload
    if (!parsed.sub || !parsed.exp) return null
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null

    return { userId: parsed.sub }
  } catch {
    return null
  }
}
