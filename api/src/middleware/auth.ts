import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

export type AuthPayload = {
  sub: string
  role: string
  email: string
}

export type AuthRequest = Request & {
  auth?: AuthPayload
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  const cookieToken =
    typeof req.cookies === 'object' && typeof req.cookies?.auth === 'string'
      ? req.cookies.auth
      : null
  const token = header
    ? header.startsWith('Bearer ')
      ? header.slice(7)
      : header
    : cookieToken

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload
    req.auth = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  return requireAuth(req, res, () => {
    if (!req.auth || req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return next()
  })
}
