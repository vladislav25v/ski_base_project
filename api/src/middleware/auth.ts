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

const resolveToken = (req: Request) => {
  const header = req.headers.authorization
  const cookieToken =
    typeof req.cookies === 'object' && typeof req.cookies?.auth === 'string'
      ? req.cookies.auth
      : null

  return header
    ? header.startsWith('Bearer ')
      ? header.slice(7)
      : header
    : cookieToken
}

export const getAuthPayload = (req: Request): AuthPayload | null => {
  const token = resolveToken(req)
  if (!token) {
    return null
  }

  try {
    return jwt.verify(token, env.jwtSecret) as AuthPayload
  } catch {
    return null
  }
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const payload = getAuthPayload(req)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.auth = payload
  return next()
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  return requireAuth(req, res, () => {
    if (!req.auth || req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return next()
  })
}
