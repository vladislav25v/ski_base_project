import { prisma } from '../src/db/prisma'
import { env } from '../src/config/env'
import { hashPassword } from '../src/lib/password'

const run = async () => {
  const passwordHash = await hashPassword(env.adminPassword)

  await prisma.user.upsert({
    where: { email: env.adminEmail },
    update: {
      passwordHash,
      role: 'admin',
    },
    create: {
      email: env.adminEmail,
      passwordHash,
      role: 'admin',
    },
  })
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
