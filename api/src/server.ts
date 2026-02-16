import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { authRouter } from './routes/auth'
import { newsRouter } from './routes/news'
import { scheduleRouter } from './routes/schedule'
import { galleryRouter } from './routes/gallery'

const app = express()

const corsOrigin = env.corsOrigin
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/auth', authRouter)
app.use('/news', newsRouter)
app.use('/schedule', scheduleRouter)
app.use('/gallery', galleryRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected error'
  res.status(500).json({ error: message })
})

app.listen(env.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on ${env.publicBaseUrl}`)
})
