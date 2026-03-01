import { prisma } from '../../db/prisma.js'
import { normalizeEmail } from './email.js'

export const isEmailAllowed = async (emailRaw: string) => {
  const emailNormalized = normalizeEmail(emailRaw)
  const entry = await prisma.allowedEmail.findUnique({
    where: { emailNormalized },
  })

  return Boolean(entry?.isActive)
}

export const touchAllowedEmailUsage = async (emailRaw: string) => {
  const emailNormalized = normalizeEmail(emailRaw)
  await prisma.allowedEmail.update({
    where: { emailNormalized },
    data: { lastUsedAt: new Date() },
  })
}

