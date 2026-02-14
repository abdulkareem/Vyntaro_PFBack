import { Redis } from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL!, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  connectTimeout: 5000,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined
})

redis.on('connect', () => {
  console.log('✅ Redis connecting')
})

redis.on('ready', () => {
  console.log('✅ Redis ready')
})

redis.on('error', (err: Error) => {
  console.error('❌ Redis error:', err.message)
})
