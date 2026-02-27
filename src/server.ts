import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.routes.js'
import { dashboardRouter } from './routes/dashboard.routes.js'
import { bootstrapAdminFromEnv } from './services/admin-bootstrap.service.js'

export const app = express()

const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const fallbackDevOrigins = ['http://localhost:3000', 'http://localhost:5173']
const allowedOrigins = new Set(
  configuredOrigins.length
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? ['https://vyntaro-pf.pages.dev']
      : fallbackDevOrigins
)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true)
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`))
    }
  })
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)

bootstrapAdminFromEnv().catch((error) => {
  console.error('Admin bootstrap failed', error)
})

const isMainModule = process.argv[1] ? import.meta.url.endsWith(process.argv[1]) : false
if (isMainModule) {
  const port = Number(process.env.PORT || 8080)
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on port ${port}`)
  })
}
