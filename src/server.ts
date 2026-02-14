import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.routes.js'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)

const port = Number(process.env.PORT || 8080)

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend running on port ${port}`)
})
