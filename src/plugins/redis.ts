import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL

export const redis = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 5000,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    })
  : null

if (!redis) {
  console.warn('⚠️ REDIS_URL is not set. OTP storage will fall back to in-memory mode.')
} else {
  redis.on('connect', () => {
    console.log('✅ Redis connecting')
  })

  redis.on('ready', () => {
    console.log('✅ Redis ready')
  })

  redis.on('error', (err: Error) => {
    console.error('❌ Redis error:', err.message)
  })
}
