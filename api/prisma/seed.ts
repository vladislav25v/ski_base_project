import { prisma } from '../src/db/prisma.js'
import { env } from '../src/config/env.js'
import { normalizeEmail } from '../src/lib/auth/email.js'

const BOOTSTRAP_ALLOWLIST_EMAILS = ['vlad-ski-96borsh@yandex.ru']

const run = async () => {
  const emails = [env.adminEmail, ...BOOTSTRAP_ALLOWLIST_EMAILS]
    .map((email) => email.trim())
    .filter(Boolean)

  const uniqueByNormalized = new Map<string, string>()
  for (const email of emails) {
    uniqueByNormalized.set(normalizeEmail(email), email)
  }

  for (const [emailNormalized, email] of uniqueByNormalized) {
    await prisma.allowedEmail.upsert({
      where: { emailNormalized },
      update: {
        isActive: true,
        email,
        comment: 'bootstrap admin allowlist',
      },
      create: {
        email,
        emailNormalized,
        isActive: true,
        comment: 'bootstrap admin allowlist',
      },
    })
  }
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
