import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.routes.js'
import { dashboardRouter } from './routes/dashboard.routes.js'

export const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)

const isMainModule = process.argv[1] ? import.meta.url.endsWith(process.argv[1]) : false
if (isMainModule) {
  const port = Number(process.env.PORT || 8080)
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on port ${port}`)
  })
}
