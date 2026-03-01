import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { sendError } from './lib/api-response.js'
import { requestContext } from './middleware/request-context.middleware.js'
import { adminRouter } from './routes/admin.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { dashboardRouter } from './routes/dashboard.routes.js'
import { ledgerRouter } from './routes/ledger.routes.js'
import { bootstrapAdminFromEnv } from './services/admin-bootstrap.service.js'

export const app = express()

const configuredOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
const fallbackDevOrigins = ['http://localhost:3000', 'http://localhost:5173']
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : process.env.NODE_ENV === 'production' ? ['https://vyntaro-pf.pages.dev'] : fallbackDevOrigins)

app.use(cors({ origin: (origin, callback) => (!origin || allowedOrigins.has(origin) ? callback(null, true) : callback(new Error('CORS blocked')) ) }))
app.use(express.json())
app.use(requestContext)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/ledger', ledgerRouter)
app.use('/api/admin', adminRouter)

app.use((_req, res) => sendError(res, 404, 'ROUTE_NOT_FOUND', 'Route not found'))

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled request error', error)
  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')
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
