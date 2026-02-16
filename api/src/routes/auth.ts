import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { env } from '../config/env'
import { verifyPassword } from '../lib/password'
import { requireAuth, type AuthRequest } from '../middleware/auth'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  domain: env.cookieDomain || undefined,
}

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid credentials' })
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: '7d' },
  )

  res.cookie('auth', token, cookieOptions)

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('auth', { ...cookieOptions, maxAge: 0 })
  return res.json({ success: true })
})

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  return res.json({
    user: {
      id: req.auth.sub,
      email: req.auth.email,
      role: req.auth.role,
    },
  })
})

export { router as authRouter }
