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

app.use((_req, res) => {
  return res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: 'Route not found' })
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled request error', error)
  return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' })
})

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
