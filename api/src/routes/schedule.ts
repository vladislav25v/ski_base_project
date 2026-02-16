import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

const daySchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  is_open: z.boolean(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
})

const scheduleSchema = z.object({
  days: z.array(daySchema),
})

router.get('/', async (_req, res) => {
  const rows = await prisma.schedule.findMany({
    orderBy: { dayOfWeek: 'asc' },
  })

  return res.json({
    items: rows.map((row: typeof rows[number]) => ({
      id: row.id,
      day_of_week: row.dayOfWeek,
      is_open: row.isOpen,
      start_time: row.startTime,
      end_time: row.endTime,
    })),
  })
})

router.put('/', requireAdmin, async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const { days } = parsed.data

  await prisma.$transaction(
    days.map((day) =>
      prisma.schedule.upsert({
        where: { dayOfWeek: day.day_of_week },
        update: {
          isOpen: day.is_open,
          startTime: day.start_time,
          endTime: day.end_time,
        },
        create: {
          dayOfWeek: day.day_of_week,
          isOpen: day.is_open,
          startTime: day.start_time,
          endTime: day.end_time,
        },
      }),
    ),
  )

  return res.json({ success: true })
})

export { router as scheduleRouter }
