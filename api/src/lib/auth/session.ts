import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { env } from '../../config/env.js'

type SessionUser = {
  id: string
  email: string
  role: string
}

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  domain: env.cookieDomain || undefined,
}

const buildToken = (user: SessionUser) =>
  jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: '7d' },
  )

export const writeAuthCookie = (res: Response, user: SessionUser) => {
  const token = buildToken(user)
  res.cookie('auth', token, cookieOptions)
}

export const clearAuthCookie = (res: Response) => {
  res.clearCookie('auth', { ...cookieOptions, maxAge: 0 })
}

export const authCookieOptions = cookieOptions
