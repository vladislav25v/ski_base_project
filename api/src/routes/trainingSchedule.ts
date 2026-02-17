import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

const daySchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  is_open: z.boolean(),
  sessions: z.array(
    z.object({
      start_time: z.string(),
      end_time: z.string(),
    }),
  ),
})

const scheduleSchema = z.object({
  days: z.array(daySchema),
})

router.get('/', async (_req, res) => {
  try {
    const rows = await prisma.trainingSchedule.findMany({
      orderBy: { dayOfWeek: 'asc' },
      include: {
        slots: {
          orderBy: { startTime: 'asc' },
        },
      },
    })

    return res.json({
      items: rows.map((row: typeof rows[number]) => ({
        id: row.id,
        day_of_week: row.dayOfWeek,
        is_open: row.isOpen,
        sessions: row.slots.map((slot) => ({
          id: slot.id,
          start_time: slot.startTime,
          end_time: slot.endTime,
        })),
      })),
    })
  } catch (error) {
    console.error('Failed to load training schedule', error)
    return res.status(500).json({ error: 'Failed to load training schedule' })
  }
})

router.put('/', requireAdmin, async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const { days } = parsed.data

  for (const day of days) {
    const sortedSessions = [...day.sessions].sort((left, right) =>
      left.start_time.localeCompare(right.start_time),
    )

    if (day.is_open && sortedSessions.length === 0) {
      return res.status(400).json({ error: 'Open day must contain at least one session' })
    }

    for (let index = 0; index < sortedSessions.length; index += 1) {
      const session = sortedSessions[index]
      if (session.start_time >= session.end_time) {
        return res.status(400).json({ error: 'Session end time must be after start time' })
      }
      if (index > 0 && sortedSessions[index - 1].end_time > session.start_time) {
        return res.status(400).json({ error: 'Sessions must not overlap' })
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const day of days) {
        const sortedSessions = [...day.sessions].sort((left, right) =>
          left.start_time.localeCompare(right.start_time),
        )
        const dayRecord = await tx.trainingSchedule.upsert({
          where: { dayOfWeek: day.day_of_week },
          update: {
            isOpen: day.is_open,
          },
          create: {
            dayOfWeek: day.day_of_week,
            isOpen: day.is_open,
          },
        })

        await tx.trainingScheduleSlot.deleteMany({
          where: { dayId: dayRecord.id },
        })

        if (day.is_open && sortedSessions.length > 0) {
          await tx.trainingScheduleSlot.createMany({
            data: sortedSessions.map((session) => ({
              dayId: dayRecord.id,
              startTime: session.start_time,
              endTime: session.end_time,
            })),
          })
        }
      }
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to update training schedule', error)
    return res.status(500).json({ error: 'Failed to update training schedule' })
  }
})

export { router as trainingScheduleRouter }
