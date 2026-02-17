import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { authRouter } from './routes/auth.js'
import { newsRouter } from './routes/news.js'
import { scheduleRouter } from './routes/schedule.js'
import { trainingScheduleRouter } from './routes/trainingSchedule.js'
import { galleryRouter } from './routes/gallery.js'

const app = express()
app.set('trust proxy', 1)

const allowedOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowAllOrigins = allowedOrigins.length === 0 || allowedOrigins.includes('*')

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) {
        return callback(null, true)
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error('Not allowed by CORS'))
    },
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
app.use('/training-schedule', trainingScheduleRouter)
app.use('/gallery', galleryRouter)

app.use(
  (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('Request failed', {
      method: req.method,
      path: req.originalUrl,
      message,
      err,
    })
    res.status(500).json({ error: message })
  },
)

app.listen(env.port, '0.0.0.0', () => {
  console.log(`API listening on ${env.publicBaseUrl}`)
})
