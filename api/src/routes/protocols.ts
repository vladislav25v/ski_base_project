import { randomUUID } from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { ProtocolStatus, Prisma } from '@prisma/client'
import { chromium, type Browser } from 'playwright'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireAdmin, type AuthRequest } from '../middleware/auth.js'
import { buildPublicUrl, removeFileSafe, uploadFileBuffer } from '../storage/index.js'

const router = Router()

const MAX_PARTICIPANTS = 500
const MAX_LAPS = 10
const MAX_PROTOCOL_FILE_SIZE = 10 * 1024 * 1024
const NAME_PATTERN = /^[\p{L}\s'-]+$/u
const ALLOWED_PROTOCOL_FILE_EXTENSIONS = new Set(['.doc', '.docx', '.xls', '.xlsx'])
const ALLOWED_PROTOCOL_FILE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

let pdfBrowserPromise: Promise<Browser> | null = null

const guestProtocolPdfLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов на печать протоколов. Попробуйте позже.' },
})

const adminProtocolPdfLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов на формирование PDF. Попробуйте позже.' },
})

const uploadPublishedProtocol = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROTOCOL_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const lowerName = file.originalname.toLowerCase()
    const extension = lowerName.slice(lowerName.lastIndexOf('.'))
    if (
      !ALLOWED_PROTOCOL_FILE_EXTENSIONS.has(extension) ||
      !ALLOWED_PROTOCOL_FILE_MIME_TYPES.has(file.mimetype)
    ) {
      return cb(new Error('Invalid protocol file type'))
    }
    return cb(null, true)
  },
})

const nullableTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) {
        return null
      }
      return value.trim()
    })

const participantSchema = z
  .object({
    number: z.number().int().min(1).max(9999),
    lastName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) => NAME_PATTERN.test(value), 'Invalid participant last name'),
    startTimeSec: z.number().int().min(0).max(24 * 60 * 60 - 1).nullable().optional(),
    finishTimeSec: z.number().int().min(0).max(24 * 60 * 60 - 1).nullable().optional(),
    netTimeSec: z.number().int().min(0).max(24 * 60 * 60 - 1).nullable().optional(),
    dsq: z.boolean().optional().default(false),
    lapTimes: z
      .array(z.number().int().min(0).max(24 * 60 * 60 - 1).nullable())
      .max(MAX_LAPS)
      .optional()
      .default([]),
  })
  .superRefine((participant, ctx) => {
    if (
      !participant.dsq &&
      typeof participant.startTimeSec === 'number' &&
      typeof participant.finishTimeSec === 'number' &&
      participant.finishTimeSec < participant.startTimeSec
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['finishTimeSec'],
        message: 'Finish time cannot be earlier than start time',
      })
    }
  })

const protocolPayloadSchema = z.object({
  title: z.string().trim().min(1).max(160),
  formationDate: z.coerce.date(),
  startIntervalSeconds: z.number().int().min(5).max(600).optional().default(30),
  sortByNetTime: z.boolean().optional().default(false),
  chiefJudgeName: nullableTrimmedString(120),
  secretaryName: nullableTrimmedString(120),
  localSourceId: z.string().trim().uuid().optional().nullable(),
  participants: z.array(participantSchema).min(1).max(MAX_PARTICIPANTS),
})

const renameSchema = z.object({
  title: z.string().trim().min(1).max(160),
})

const uploadPublishedSchema = z.object({
  title: z.string().trim().min(1).max(160),
  formationDate: z.coerce.date(),
})

type ProtocolRecord = Prisma.ProtocolGetPayload<{
  include: {
    participants: {
      include: {
        lapTimes: true
      }
      orderBy: {
        sortOrder: 'asc'
      }
    }
  }
}>

const includeParticipants = {
  participants: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      lapTimes: {
        orderBy: { lapIndex: 'asc' as const },
      },
    },
  },
}

const formatSec = (value: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return ''
  }
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

const computeNetTimeSec = (input: {
  dsq: boolean
  startTimeSec: number | null
  finishTimeSec: number | null
  netTimeSec: number | null
}) => {
  if (input.dsq) {
    return null
  }
  if (typeof input.startTimeSec === 'number' && typeof input.finishTimeSec === 'number') {
    if (input.finishTimeSec < input.startTimeSec) {
      return null
    }
    return input.finishTimeSec - input.startTimeSec
  }
  if (typeof input.netTimeSec === 'number') {
    return input.netTimeSec
  }
  return null
}

const toProtocolDto = (record: ProtocolRecord) => ({
  id: record.id,
  title: record.title,
  formationDate: record.formationDate.toISOString(),
  startIntervalSeconds: record.startIntervalSeconds,
  sortByNetTime: record.sortByNetTime,
  chiefJudgeName: record.chiefJudgeName,
  secretaryName: record.secretaryName,
  status: record.status,
  localSourceId: record.localSourceId,
  formedAt: record.formedAt?.toISOString() ?? null,
  publishedAt: record.publishedAt?.toISOString() ?? null,
  pdfStoragePath: record.pdfStoragePath,
  pdfFileName: record.pdfFileName,
  pdfPublicUrl: record.pdfStoragePath ? buildPublicUrl(record.pdfStoragePath) : null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  participants: record.participants.map((participant) => ({
    id: participant.id,
    number: participant.number,
    lastName: participant.lastName,
    startTimeSec: participant.startTimeSec,
    finishTimeSec: participant.finishTimeSec,
    netTimeSec: participant.netTimeSec,
    dsq: participant.dsq,
    sortOrder: participant.sortOrder,
    lapTimes: participant.lapTimes
      .sort((left, right) => left.lapIndex - right.lapIndex)
      .map((item) => item.lapTimeSec),
  })),
})

const normalizeProtocolPayload = (payload: z.infer<typeof protocolPayloadSchema>, userId: string | null) => {
  const participants = payload.participants.map((participant, index) => {
    const startTimeSec = participant.startTimeSec ?? null
    const finishTimeSec = participant.finishTimeSec ?? null
    const netTimeSec = computeNetTimeSec({
      dsq: participant.dsq,
      startTimeSec,
      finishTimeSec,
      netTimeSec: participant.netTimeSec ?? null,
    })

    if (
      !participant.dsq &&
      typeof startTimeSec === 'number' &&
      typeof finishTimeSec === 'number' &&
      finishTimeSec < startTimeSec
    ) {
      throw new Error('Finish time cannot be earlier than start time')
    }

    return {
      sortOrder: index,
      number: participant.number,
      lastName: participant.lastName.trim(),
      startTimeSec,
      finishTimeSec,
      netTimeSec,
      dsq: participant.dsq,
      lapTimes: participant.lapTimes.map((lapTimeSec, lapIndex) => ({
        lapIndex,
        lapTimeSec,
      })),
    }
  })

  return {
    title: payload.title.trim(),
    formationDate: payload.formationDate,
    startIntervalSeconds: payload.startIntervalSeconds,
    sortByNetTime: payload.sortByNetTime,
    chiefJudgeName: payload.chiefJudgeName,
    secretaryName: payload.secretaryName,
    localSourceId: payload.localSourceId ?? null,
    createdByUserId: userId,
    participants,
  }
}

const upsertParticipants = (participants: ReturnType<typeof normalizeProtocolPayload>['participants']) => ({
  create: participants.map((participant) => ({
    sortOrder: participant.sortOrder,
    number: participant.number,
    lastName: participant.lastName,
    startTimeSec: participant.startTimeSec,
    finishTimeSec: participant.finishTimeSec,
    netTimeSec: participant.netTimeSec,
    dsq: participant.dsq,
    lapTimes: {
      create: participant.lapTimes,
    },
  })),
})

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const buildContentDisposition = (fileName: string) => {
  const asciiFallback =
    fileName
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]+/g, '_')
      .replace(/["\\]/g, '_') || 'protocol.pdf'

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

const getPdfBrowser = async () => {
  if (!pdfBrowserPromise) {
    pdfBrowserPromise = chromium
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
        ],
      })
      .then((browser) => {
        browser.on('disconnected', () => {
          pdfBrowserPromise = null
        })
        return browser
      })
      .catch((error) => {
        pdfBrowserPromise = null
        throw error
      })
  }
  return pdfBrowserPromise
}

const renderProtocolHtml = (record: ProtocolRecord) => {
  const ordered = [...record.participants].sort((left, right) => left.sortOrder - right.sortOrder)
  const maxLaps = ordered.reduce((acc, participant) => Math.max(acc, participant.lapTimes.length), 0)
  const dateLabel = new Date(record.formationDate).toLocaleDateString('ru-RU')
  const lapHeaders = Array.from({ length: maxLaps }, (_v, index) => `<th>Круг ${index + 1}</th>`).join('')

  const rows = ordered
    .map((participant, index) => {
      const laps = Array.from({ length: maxLaps }, (_v, lapIndex) => {
        const lap = participant.lapTimes.find((item) => item.lapIndex === lapIndex)
        return `<td>${escapeHtml(formatSec(lap?.lapTimeSec ?? null))}</td>`
      }).join('')
      const finish = participant.dsq ? 'DSQ' : formatSec(participant.finishTimeSec)
      const net = participant.dsq ? 'DSQ' : formatSec(participant.netTimeSec)
      return `
        <tr>
          <td>${participant.number > 0 ? participant.number : index + 1}</td>
          <td class="left">${escapeHtml(participant.lastName)}</td>
          <td>${escapeHtml(formatSec(participant.startTimeSec))}</td>
          ${laps}
          <td>${escapeHtml(finish)}</td>
          <td>${escapeHtml(net)}</td>
        </tr>
      `
    })
    .join('')

  return `
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <style>
      @page { size: A4; margin: 14mm 10mm 28mm 10mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111;
        font-family: "Arial", "DejaVu Sans", sans-serif;
        font-size: 12px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 18px;
        line-height: 1.25;
      }
      .meta {
        margin-bottom: 10px;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #111;
        padding: 4px 6px;
        text-align: center;
        vertical-align: middle;
        word-wrap: break-word;
      }
      th {
        font-weight: 700;
        background: #f5f5f5;
      }
      .left {
        text-align: left;
      }
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <div>
      <h1>${escapeHtml(record.title)}</h1>
      <div class="meta">Дата формирования: ${escapeHtml(dateLabel)}</div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%">№</th>
            <th style="width: 24%">Фамилия</th>
            <th style="width: 12%">Старт</th>
            ${lapHeaders}
            <th style="width: 14%">Финиш</th>
            <th style="width: 14%">Чистое время</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </body>
</html>
  `
}

const renderFooterTemplate = (record: ProtocolRecord) => {
  const chief = escapeHtml(record.chiefJudgeName ?? '')
  const secretary = escapeHtml(record.secretaryName ?? '')
  return `
  <div style="width:100%; padding:0 10mm 4mm; font-family:Arial,'DejaVu Sans',sans-serif; font-size:12px; color:#111;">
    <div style="display:flex; gap:12mm; align-items:center;">
      <div style="flex:1; display:flex; align-items:flex-end; gap:6px; min-width:0;">
        <span style="white-space:nowrap;">Главный судья:</span>
        <span style="max-width:42%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${chief}</span>
        <span style="flex:1; border-bottom:1px solid #111; height:0; margin-bottom:1px;"></span>
      </div>
      <div style="flex:1; display:flex; align-items:flex-end; gap:6px; min-width:0;">
        <span style="white-space:nowrap;">Секретарь:</span>
        <span style="max-width:42%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${secretary}</span>
        <span style="flex:1; border-bottom:1px solid #111; height:0; margin-bottom:1px;"></span>
      </div>
    </div>
  </div>
`
}

const drawPdf = async (record: ProtocolRecord) => {
  const browser = await getPdfBrowser()
  const page = await browser.newPage()
  try {
    const html = renderProtocolHtml(record)
    const footerTemplate = renderFooterTemplate(record)
    await page.setContent(html, { waitUntil: 'load' })
    const result = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      margin: { top: '14mm', right: '10mm', bottom: '24mm', left: '10mm' },
    })
    return Buffer.from(result)
  } finally {
    await page.close()
  }
}

const toProtocolRecordFromPayload = (payload: z.infer<typeof protocolPayloadSchema>): ProtocolRecord => {
  const normalized = normalizeProtocolPayload(payload, null)
  return {
    id: randomUUID(),
    title: normalized.title,
    formationDate: normalized.formationDate,
    startIntervalSeconds: normalized.startIntervalSeconds,
    sortByNetTime: normalized.sortByNetTime,
    chiefJudgeName: normalized.chiefJudgeName,
    secretaryName: normalized.secretaryName,
    status: ProtocolStatus.FORMED,
    formedAt: new Date(),
    publishedAt: null,
    pdfStoragePath: null,
    pdfFileName: null,
    localSourceId: normalized.localSourceId,
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: normalized.participants.map((participant) => ({
      id: randomUUID(),
      protocolId: '',
      sortOrder: participant.sortOrder,
      number: participant.number,
      lastName: participant.lastName,
      startTimeSec: participant.startTimeSec,
      finishTimeSec: participant.finishTimeSec,
      netTimeSec: participant.netTimeSec,
      dsq: participant.dsq,
      createdAt: new Date(),
      updatedAt: new Date(),
      lapTimes: participant.lapTimes.map((lap) => ({
        id: randomUUID(),
        participantId: '',
        lapIndex: lap.lapIndex,
        lapTimeSec: lap.lapTimeSec,
      })),
    })),
  } as ProtocolRecord
}

router.get('/published', async (_req, res) => {
  try {
    const items = await prisma.protocol.findMany({
      where: { status: ProtocolStatus.PUBLISHED },
      orderBy: [{ publishedAt: 'desc' }, { formationDate: 'desc' }],
      include: includeParticipants,
    })
    return res.json({ items: items.map(toProtocolDto) })
  } catch (error) {
    console.error('Failed to load published protocols', error)
    return res.status(500).json({ error: 'Не удалось загрузить опубликованные протоколы' })
  }
})

router.get('/published/:id/download', async (req, res) => {
  try {
    const item = await prisma.protocol.findFirst({
      where: { id: req.params.id, status: ProtocolStatus.PUBLISHED },
      select: { pdfStoragePath: true, pdfFileName: true },
    })
    if (!item || !item.pdfStoragePath) {
      return res.status(404).json({ error: 'Файл протокола не найден' })
    }

    return res.redirect(302, buildPublicUrl(item.pdfStoragePath))
  } catch (error) {
    console.error('Failed to download published protocol', error)
    return res.status(500).json({ error: 'Не удалось скачать протокол' })
  }
})

router.post('/published/upload', requireAdmin, (req, res) => {
  uploadPublishedProtocol.single('file')(req, res, async (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл превышает 10 МБ.' })
      }
      return res.status(400).json({ error: 'Не удалось загрузить файл протокола.' })
    }
    if (error) {
      return res.status(400).json({ error: 'Допустимы только файлы DOC, DOCX, XLS и XLSX.' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'Файл протокола не выбран.' })
    }

    const parsed = uploadPublishedSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Некорректные данные протокола.' })
    }

    try {
      const uploaded = await uploadFileBuffer({
        prefix: 'protocols',
        fileName: file.originalname,
        contentType: file.mimetype,
        buffer: file.buffer,
      })

      const created = await prisma.protocol.create({
        data: {
          title: parsed.data.title.trim(),
          formationDate: parsed.data.formationDate,
          startIntervalSeconds: 30,
          sortByNetTime: false,
          chiefJudgeName: null,
          secretaryName: null,
          status: ProtocolStatus.PUBLISHED,
          formedAt: null,
          publishedAt: new Date(),
          pdfStoragePath: uploaded.key,
          pdfFileName: file.originalname,
          localSourceId: null,
          createdByUserId: (req as AuthRequest).auth?.sub ?? null,
        },
        include: includeParticipants,
      })

      return res.json({ item: toProtocolDto(created) })
    } catch (uploadError) {
      console.error('Failed to upload published protocol file', uploadError)
      return res.status(500).json({ error: 'Не удалось сохранить файл протокола.' })
    }
  })
})

router.get('/drafts', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const items = await prisma.protocol.findMany({
      where: { status: { in: [ProtocolStatus.DRAFT, ProtocolStatus.FORMED] } },
      orderBy: [{ updatedAt: 'desc' }],
      include: includeParticipants,
    })
    return res.json({ items: items.map(toProtocolDto) })
  } catch (error) {
    console.error('Failed to load drafts', error)
    return res.status(500).json({ error: 'Не удалось загрузить черновики' })
  }
})

router.post('/drafts', requireAdmin, async (req: AuthRequest, res) => {
  const parsed = protocolPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Некорректные данные протокола' })
  }

  try {
    const normalized = normalizeProtocolPayload(parsed.data, req.auth?.sub ?? null)
    const created = await prisma.protocol.create({
      data: {
        title: normalized.title,
        formationDate: normalized.formationDate,
        startIntervalSeconds: normalized.startIntervalSeconds,
        sortByNetTime: normalized.sortByNetTime,
        chiefJudgeName: normalized.chiefJudgeName,
        secretaryName: normalized.secretaryName,
        localSourceId: normalized.localSourceId,
        createdByUserId: normalized.createdByUserId,
        status: ProtocolStatus.DRAFT,
        participants: upsertParticipants(normalized.participants),
      },
      include: includeParticipants,
    })
    return res.json({ item: toProtocolDto(created) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать черновик'
    return res.status(400).json({ error: message })
  }
})

router.put('/drafts/:id', requireAdmin, async (req: AuthRequest, res) => {
  const parsed = protocolPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Некорректные данные протокола' })
  }

  try {
    const existing = await prisma.protocol.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      return res.status(404).json({ error: 'Черновик не найден' })
    }

    const normalized = normalizeProtocolPayload(parsed.data, existing.createdByUserId)
    const updated = await prisma.protocol.update({
      where: { id: existing.id },
      data: {
        title: normalized.title,
        formationDate: normalized.formationDate,
        startIntervalSeconds: normalized.startIntervalSeconds,
        sortByNetTime: normalized.sortByNetTime,
        chiefJudgeName: normalized.chiefJudgeName,
        secretaryName: normalized.secretaryName,
        localSourceId: normalized.localSourceId,
        status: ProtocolStatus.DRAFT,
        publishedAt: null,
        participants: {
          deleteMany: {},
          ...upsertParticipants(normalized.participants),
        },
      },
      include: includeParticipants,
    })

    return res.json({ item: toProtocolDto(updated) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось обновить черновик'
    return res.status(400).json({ error: message })
  }
})

router.delete('/drafts/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.protocol.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      return res.status(404).json({ error: 'Черновик не найден' })
    }
    await removeFileSafe(existing.pdfStoragePath)
    await prisma.protocol.delete({ where: { id: existing.id } })
    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete draft', error)
    return res.status(500).json({ error: 'Не удалось удалить черновик' })
  }
})

router.post('/drafts/:id/form', requireAdmin, adminProtocolPdfLimiter, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.protocol.findUnique({
      where: { id: req.params.id },
      include: includeParticipants,
    })
    if (!existing) {
      return res.status(404).json({ error: 'Черновик не найден' })
    }

    const pdfBuffer = await drawPdf(existing)
    const safeTitle = existing.title.replace(/[^\p{L}\d_-]+/gu, '_').slice(0, 80) || 'protocol'
    const pdfFileName = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`

    const uploaded = await uploadFileBuffer({
      prefix: 'protocols',
      fileName: pdfFileName,
      contentType: 'application/pdf',
      buffer: pdfBuffer,
    })

    if (existing.pdfStoragePath && existing.pdfStoragePath !== uploaded.key) {
      await removeFileSafe(existing.pdfStoragePath)
    }

    const updated = await prisma.protocol.update({
      where: { id: existing.id },
      data: {
        status: ProtocolStatus.FORMED,
        formedAt: new Date(),
        pdfStoragePath: uploaded.key,
        pdfFileName,
      },
      include: includeParticipants,
    })

    return res.json({
      item: toProtocolDto(updated),
      downloadUrl: uploaded.publicUrl,
    })
  } catch (error) {
    console.error('Failed to form draft PDF', error)
    return res.status(500).json({ error: 'Не удалось сформировать PDF' })
  }
})

router.post('/drafts/:id/publish', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.protocol.findUnique({
      where: { id: req.params.id },
      include: includeParticipants,
    })
    if (!existing) {
      return res.status(404).json({ error: 'Черновик не найден' })
    }
    if (!existing.pdfStoragePath) {
      return res.status(400).json({ error: 'Сначала сформируйте PDF' })
    }

    const updated = await prisma.protocol.update({
      where: { id: existing.id },
      data: {
        status: ProtocolStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: includeParticipants,
    })
    return res.json({ item: toProtocolDto(updated) })
  } catch (error) {
    console.error('Failed to publish protocol', error)
    return res.status(500).json({ error: 'Не удалось опубликовать протокол' })
  }
})

router.put('/published/:id', requireAdmin, async (req: AuthRequest, res) => {
  const parsed = renameSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Некорректное название протокола' })
  }

  try {
    const existing = await prisma.protocol.findFirst({
      where: { id: req.params.id, status: ProtocolStatus.PUBLISHED },
      include: includeParticipants,
    })
    if (!existing) {
      return res.status(404).json({ error: 'Опубликованный протокол не найден' })
    }

    const updated = await prisma.protocol.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title.trim(),
      },
      include: includeParticipants,
    })

    return res.json({ item: toProtocolDto(updated) })
  } catch (error) {
    console.error('Failed to rename published protocol', error)
    return res.status(500).json({ error: 'Не удалось переименовать протокол' })
  }
})

router.delete('/published/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.protocol.findFirst({
      where: { id: req.params.id, status: ProtocolStatus.PUBLISHED },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Опубликованный протокол не найден' })
    }
    await removeFileSafe(existing.pdfStoragePath)
    await prisma.protocol.delete({ where: { id: existing.id } })
    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete published protocol', error)
    return res.status(500).json({ error: 'Не удалось удалить протокол' })
  }
})

router.post('/guest/form', guestProtocolPdfLimiter, async (req, res) => {
  const parsed = protocolPayloadSchema.safeParse(req.body?.protocol ?? req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Некорректные данные протокола' })
  }

  try {
    const protocolRecord = toProtocolRecordFromPayload(parsed.data)
    const pdfBuffer = await drawPdf(protocolRecord)
    const safeTitle = protocolRecord.title.replace(/[^\p{L}\d_-]+/gu, '_').slice(0, 80) || 'protocol'
    const fileName = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', buildContentDisposition(fileName))
    return res.send(pdfBuffer)
  } catch (error) {
    console.error('Failed to form guest PDF', error)
    return res.status(500).json({ error: 'Не удалось сформировать PDF' })
  }
})

export { router as protocolsRouter }
