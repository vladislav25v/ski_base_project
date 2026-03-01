import { Router } from 'express'
import type { Response } from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { env } from '../config/env.js'
import { hashPassword } from '../lib/password.js'
import { clearAuthCookie, writeAuthCookie, authCookieOptions } from '../lib/auth/session.js'
import { normalizeEmail } from '../lib/auth/email.js'
import { isEmailAllowed, touchAllowedEmailUsage } from '../lib/auth/allowlist.js'
import { logAuthEvent } from '../lib/auth/audit.js'
import {
  buildYandexAuthUrl,
  exchangeYandexCode,
  fetchYandexProfile,
  resolveProfileEmail,
} from '../lib/oauth/yandex.js'
import { requireAdmin, requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const yandexCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
})

const allowlistCreateSchema = z.object({
  email: z.string().email(),
  comment: z.string().max(500).optional(),
})

const allowlistUpdateSchema = z.object({
  isActive: z.boolean(),
  comment: z.string().max(500).optional(),
})

const securityStatsQuerySchema = z.object({
  hours: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value))
    .refine((value) => value >= 1 && value <= 24 * 30)
    .optional(),
})

const oauthStateCookieName = 'oauth_yandex_state'
const oauthStateCookieOptions = {
  ...authCookieOptions,
  maxAge: 10 * 60 * 1000,
}

const yandexAuthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OAuth requests. Try again later.' },
})

const allowlistWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many allowlist changes. Try again later.' },
})

const resolveFrontendBaseUrl = () => {
  const configured = env.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*')
  return configured[0] ?? 'http://localhost:5173'
}

const frontendBaseUrl = resolveFrontendBaseUrl()
const successRedirectUrl = env.authSuccessRedirectUrl || `${frontendBaseUrl}/admin`
const errorRedirectBaseUrl = env.authErrorRedirectUrl || `${frontendBaseUrl}/admin`

const buildAccessDeniedRedirectUrl = () => {
  const redirect = new URL(errorRedirectBaseUrl)
  redirect.searchParams.set('auth_error', 'access_denied')
  return redirect.toString()
}

const isYandexEnabled =
  Boolean(env.yandexClientId) && Boolean(env.yandexClientSecret) && Boolean(env.yandexRedirectUri)

const createState = () => crypto.randomBytes(32).toString('hex')

const isStateValid = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

const getRequestIp = (req: AuthRequest) => req.ip || req.socket.remoteAddress || null
const getUserAgent = (req: AuthRequest) =>
  typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null

const sendAccessDeniedRedirect = (res: Response) =>
  res.redirect(302, buildAccessDeniedRedirectUrl())

router.get('/yandex/start', yandexAuthLimiter, async (req: AuthRequest, res) => {
  if (!isYandexEnabled) {
    await logAuthEvent({
      action: 'oauth_yandex_start',
      status: 'error',
      reason: 'oauth_not_configured',
      ip: getRequestIp(req) ?? undefined,
      userAgent: getUserAgent(req) ?? undefined,
    })
    return res.status(503).json({ error: 'Yandex OAuth is not configured' })
  }

  const state = createState()
  const redirectUrl = buildYandexAuthUrl({
    clientId: env.yandexClientId,
    redirectUri: env.yandexRedirectUri,
    state,
  })

  res.cookie(oauthStateCookieName, state, oauthStateCookieOptions)
  return res.redirect(302, redirectUrl)
})

router.get('/yandex/callback', yandexAuthLimiter, async (req: AuthRequest, res) => {
  const ip = getRequestIp(req) ?? undefined
  const userAgent = getUserAgent(req) ?? undefined

  if (!isYandexEnabled) {
    await logAuthEvent({
      action: 'oauth_yandex_callback',
      status: 'error',
      reason: 'oauth_not_configured',
      ip,
      userAgent,
    })
    return sendAccessDeniedRedirect(res)
  }

  const parsed = yandexCallbackSchema.safeParse(req.query)
  if (!parsed.success) {
    await logAuthEvent({
      action: 'oauth_yandex_callback',
      status: 'denied',
      reason: 'invalid_callback_payload',
      ip,
      userAgent,
    })
    return sendAccessDeniedRedirect(res)
  }

  const stateFromCookie =
    typeof req.cookies?.[oauthStateCookieName] === 'string' ? req.cookies[oauthStateCookieName] : ''

  res.clearCookie(oauthStateCookieName, {
    ...oauthStateCookieOptions,
    maxAge: 0,
  })

  if (parsed.data.error || !parsed.data.code || !parsed.data.state) {
    await logAuthEvent({
      action: 'oauth_yandex_callback',
      status: 'denied',
      reason: parsed.data.error ? 'provider_error' : 'missing_code_or_state',
      ip,
      userAgent,
    })
    return sendAccessDeniedRedirect(res)
  }

  if (!stateFromCookie || !isStateValid(parsed.data.state, stateFromCookie)) {
    await logAuthEvent({
      action: 'oauth_yandex_callback',
      status: 'denied',
      reason: 'invalid_state',
      ip,
      userAgent,
    })
    return sendAccessDeniedRedirect(res)
  }

  try {
    const accessToken = await exchangeYandexCode({
      code: parsed.data.code,
      clientId: env.yandexClientId,
      clientSecret: env.yandexClientSecret,
    })

    const profile = await fetchYandexProfile(accessToken)
    const rawEmail = resolveProfileEmail(profile)
    if (!rawEmail) {
      await logAuthEvent({
        action: 'oauth_yandex_callback',
        status: 'denied',
        reason: 'missing_profile_email',
        ip,
        userAgent,
      })
      return sendAccessDeniedRedirect(res)
    }

    const emailNormalized = normalizeEmail(rawEmail)
    const allowed = await isEmailAllowed(emailNormalized)
    if (!allowed) {
      await logAuthEvent({
        action: 'oauth_yandex_callback',
        status: 'denied',
        reason: 'email_not_in_allowlist',
        emailNormalized,
        ip,
        userAgent,
      })
      return sendAccessDeniedRedirect(res)
    }

    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalized } })
    if (existingUser && existingUser.role !== 'admin') {
      await logAuthEvent({
        action: 'oauth_yandex_callback',
        status: 'denied',
        reason: 'user_role_not_admin',
        emailNormalized,
        userId: existingUser.id,
        ip,
        userAgent,
      })
      return sendAccessDeniedRedirect(res)
    }

    const user =
      existingUser ??
      (await prisma.user.create({
        data: {
          email: emailNormalized,
          role: 'admin',
          passwordHash: await hashPassword(crypto.randomUUID()),
        },
      }))

    writeAuthCookie(res, {
      id: user.id,
      email: user.email,
      role: user.role,
    })

    await touchAllowedEmailUsage(emailNormalized)
    await logAuthEvent({
      action: 'oauth_yandex_callback',
      status: 'success',
      reason: 'oauth_login_success',
      emailNormalized,
      userId: user.id,
      ip,
      userAgent,
    })

    return res.redirect(302, successRedirectUrl)
  } catch (error) {
    console.error('Yandex OAuth callback failed', error)
    await logAuthEvent({
      action: 'oauth_yandex_callback',
      status: 'error',
      reason: 'oauth_exchange_failed',
      ip,
      userAgent,
    })
    return sendAccessDeniedRedirect(res)
  }
})

router.get('/allowlist', requireAdmin, async (_req: AuthRequest, res) => {
  const items = await prisma.allowedEmail.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  })

  return res.json({
    items: items.map((item) => ({
      id: item.id,
      email: item.email,
      email_normalized: item.emailNormalized,
      is_active: item.isActive,
      comment: item.comment,
      created_by_user_id: item.createdByUserId,
      updated_by_user_id: item.updatedByUserId,
      last_used_at: item.lastUsedAt?.toISOString() ?? null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    })),
  })
})

router.post('/allowlist', requireAdmin, allowlistWriteLimiter, async (req: AuthRequest, res) => {
  const parsed = allowlistCreateSchema.safeParse(req.body)
  if (!parsed.success || !req.auth) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const emailNormalized = normalizeEmail(parsed.data.email)

  const entry = await prisma.allowedEmail.upsert({
    where: { emailNormalized },
    update: {
      email: parsed.data.email.trim(),
      isActive: true,
      comment: parsed.data.comment?.trim() || null,
      updatedByUserId: req.auth.sub,
    },
    create: {
      email: parsed.data.email.trim(),
      emailNormalized,
      isActive: true,
      comment: parsed.data.comment?.trim() || null,
      createdByUserId: req.auth.sub,
      updatedByUserId: req.auth.sub,
    },
  })

  await logAuthEvent({
    action: 'allowlist_upsert',
    status: 'success',
    reason: 'allowlist_changed',
    emailNormalized,
    userId: req.auth.sub,
    ip: getRequestIp(req) ?? undefined,
    userAgent: getUserAgent(req) ?? undefined,
  })

  return res.json({
    item: {
      id: entry.id,
      email: entry.email,
      email_normalized: entry.emailNormalized,
      is_active: entry.isActive,
      comment: entry.comment,
      created_by_user_id: entry.createdByUserId,
      updated_by_user_id: entry.updatedByUserId,
      last_used_at: entry.lastUsedAt?.toISOString() ?? null,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    },
  })
})

router.patch('/allowlist/:id', requireAdmin, allowlistWriteLimiter, async (req: AuthRequest, res) => {
  const parsed = allowlistUpdateSchema.safeParse(req.body)
  if (!parsed.success || !req.auth) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const existing = await prisma.allowedEmail.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    return res.status(404).json({ error: 'Not found' })
  }

  const updated = await prisma.allowedEmail.update({
    where: { id: existing.id },
    data: {
      isActive: parsed.data.isActive,
      comment: parsed.data.comment?.trim() || null,
      updatedByUserId: req.auth.sub,
    },
  })

  await logAuthEvent({
    action: 'allowlist_update',
    status: 'success',
    reason: 'allowlist_changed',
    emailNormalized: existing.emailNormalized,
    userId: req.auth.sub,
    ip: getRequestIp(req) ?? undefined,
    userAgent: getUserAgent(req) ?? undefined,
  })

  return res.json({
    item: {
      id: updated.id,
      email: updated.email,
      email_normalized: updated.emailNormalized,
      is_active: updated.isActive,
      comment: updated.comment,
      created_by_user_id: updated.createdByUserId,
      updated_by_user_id: updated.updatedByUserId,
      last_used_at: updated.lastUsedAt?.toISOString() ?? null,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    },
  })
})

router.get('/security/stats', requireAdmin, async (req: AuthRequest, res) => {
  const parsed = securityStatsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query' })
  }

  const hours = parsed.data.hours ?? 24
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [successCount, deniedCount, errorCount, deniedByReason, allowlistDeniedCount] =
    await prisma.$transaction([
      prisma.authEvent.count({
        where: { action: 'oauth_yandex_callback', status: 'success', createdAt: { gte: since } },
      }),
      prisma.authEvent.count({
        where: { action: 'oauth_yandex_callback', status: 'denied', createdAt: { gte: since } },
      }),
      prisma.authEvent.count({
        where: { action: 'oauth_yandex_callback', status: 'error', createdAt: { gte: since } },
      }),
      prisma.authEvent.groupBy({
        by: ['reason'],
        where: { action: 'oauth_yandex_callback', status: 'denied', createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.authEvent.count({
        where: {
          action: 'oauth_yandex_callback',
          status: 'denied',
          reason: 'email_not_in_allowlist',
          createdAt: { gte: since },
        },
      }),
    ])

  return res.json({
    window_hours: hours,
    since: since.toISOString(),
    oauth_yandex: {
      success_count: successCount,
      denied_count: deniedCount,
      error_count: errorCount,
      denied_allowlist_count: allowlistDeniedCount,
      denied_by_reason: deniedByReason.map((item) => ({
        reason: item.reason ?? 'unknown',
        count: item._count._all,
      })),
    },
  })
})

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
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
