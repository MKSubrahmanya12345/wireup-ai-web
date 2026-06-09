import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { ingestionRouter } from './routes/ingestion.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '5mb' }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/ingestion', ingestionRouter)

  app.use(errorHandler)

  return app
}

