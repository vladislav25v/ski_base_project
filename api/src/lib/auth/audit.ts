import { prisma } from '../../db/prisma.js'

export type AuthAuditStatus = 'success' | 'denied' | 'error'

export type AuthAuditEvent = {
  action: string
  status: AuthAuditStatus
  reason?: string
  emailNormalized?: string
  userId?: string
  ip?: string
  userAgent?: string
}

export const logAuthEvent = async (event: AuthAuditEvent) => {
  try {
    await prisma.authEvent.create({
      data: {
        action: event.action,
        status: event.status,
        reason: event.reason ?? null,
        emailNormalized: event.emailNormalized ?? null,
        userId: event.userId ?? null,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to persist auth audit event', {
      action: event.action,
      status: event.status,
      reason: event.reason,
      error,
    })
  }
}

