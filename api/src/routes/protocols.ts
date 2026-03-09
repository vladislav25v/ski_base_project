import { randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import rateLimit from 'express-rate-limit'
import { ProtocolStatus, Prisma } from '@prisma/client'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
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

const PDF_PAGE_WIDTH = 595.28
const PDF_PAGE_HEIGHT = 841.89
const PDF_MARGIN_TOP = 40
const PDF_MARGIN_RIGHT = 28
const PDF_MARGIN_BOTTOM = 72
const PDF_MARGIN_LEFT = 28
const PDF_HEADER_GAP = 14
const PDF_TABLE_HEADER_HEIGHT = 24
const PDF_CELL_PADDING_X = 4
const PDF_CELL_PADDING_Y = 4
const PDF_FONT_SIZE = 10
const PDF_SMALL_FONT_SIZE = 9
const PDF_TITLE_FONT_SIZE = 16
const PDF_META_FONT_SIZE = 11
const PDF_LINE_HEIGHT = 12
const PDF_ROW_MIN_HEIGHT = 22
const PDF_SIGNATURE_GAP = 26
const PDF_SIGNATURE_LINE_WIDTH = 120
const PDF_FONT_CANDIDATES = [
  process.env.PDF_FONT_PATH,
  'C:\\Windows\\Fonts\\arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
].filter((value): value is string => Boolean(value))

const guestProtocolPdfLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов на печать протоколов. Попробуйте позже.' },
})

const adminProtocolPdfLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 150,
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

const buildContentDisposition = (fileName: string) => {
  const asciiFallback =
    fileName
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]+/g, '_')
      .replace(/["\\]/g, '_') || 'protocol.pdf'

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

const resolvePdfFontPath = () => {
  const matched = PDF_FONT_CANDIDATES.map((candidate) => path.resolve(candidate)).find((candidate) =>
    existsSync(candidate),
  )
  if (!matched) {
    throw new Error(
      `PDF font not found. Set PDF_FONT_PATH or install one of: ${PDF_FONT_CANDIDATES.join(', ')}`
    )
  }
  return matched
}

const measureTextWidth = (font: PDFFont, value: string, fontSize: number) =>
  value.length === 0 ? 0 : font.widthOfTextAtSize(value, fontSize)

const wrapPdfText = (font: PDFFont, value: string, fontSize: number, maxWidth: number) => {
  if (!value) {
    return ['']
  }

  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return ['']
  }

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measureTextWidth(font, candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (measureTextWidth(font, word, fontSize) <= maxWidth) {
      current = word
      continue
    }

    let fragment = ''
    for (const char of Array.from(word)) {
      const fragmentCandidate = `${fragment}${char}`
      if (measureTextWidth(font, fragmentCandidate, fontSize) <= maxWidth) {
        fragment = fragmentCandidate
        continue
      }
      if (fragment) {
        lines.push(fragment)
      }
      fragment = char
    }
    current = fragment
  }

  if (current) {
    lines.push(current)
  }

  return lines.length > 0 ? lines : ['']
}

const trimToFit = (font: PDFFont, value: string, fontSize: number, maxWidth: number) => {
  if (measureTextWidth(font, value, fontSize) <= maxWidth) {
    return value
  }

  const ellipsis = '...'
  let result = value
  while (result.length > 1 && measureTextWidth(font, `${result}${ellipsis}`, fontSize) > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}${ellipsis}`
}

const drawPageFooter = (page: PDFPage, font: PDFFont, record: ProtocolRecord) => {
  const baselineY = PDF_MARGIN_BOTTOM - 24
  const halfWidth = (PDF_PAGE_WIDTH - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT - 24) / 2

  const drawSignatureBlock = (x: number, label: string, name: string | null) => {
    const textBaselineY = baselineY
    page.drawText(label, {
      x,
      y: textBaselineY,
      size: PDF_META_FONT_SIZE,
      font,
      color: rgb(0.07, 0.07, 0.07),
    })

    const labelWidth = measureTextWidth(font, label, PDF_META_FONT_SIZE)
    const nameValue = trimToFit(font, name ?? '', PDF_META_FONT_SIZE, Math.min(halfWidth * 0.34, 90))
    const nameX = x + labelWidth + 6
    if (nameValue) {
      page.drawText(nameValue, {
        x: nameX,
        y: textBaselineY,
        size: PDF_META_FONT_SIZE,
        font,
        color: rgb(0.07, 0.07, 0.07),
      })
    }

    const nameWidth = nameValue ? measureTextWidth(font, nameValue, PDF_META_FONT_SIZE) : 0
    const lineX = nameX + nameWidth + 8
    const lineWidth = Math.max(60, Math.min(PDF_SIGNATURE_LINE_WIDTH, x + halfWidth - lineX))
    page.drawLine({
      start: { x: lineX, y: textBaselineY - 1 },
      end: { x: lineX + lineWidth, y: textBaselineY - 1 },
      thickness: 1,
      color: rgb(0.07, 0.07, 0.07),
    })
  }

  drawSignatureBlock(PDF_MARGIN_LEFT, 'Главный судья:', record.chiefJudgeName)
  drawSignatureBlock(PDF_MARGIN_LEFT + halfWidth + 24, 'Секретарь:', record.secretaryName)
}

const drawProtocolHeader = (
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  record: ProtocolRecord,
) => {
  let cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP
  page.drawText(record.title, {
    x: PDF_MARGIN_LEFT,
    y: cursorY,
    size: PDF_TITLE_FONT_SIZE,
    font: boldFont,
    color: rgb(0.07, 0.07, 0.07),
  })
  cursorY -= PDF_TITLE_FONT_SIZE + 8
  page.drawText(`Дата формирования: ${new Date(record.formationDate).toLocaleDateString('ru-RU')}`, {
    x: PDF_MARGIN_LEFT,
    y: cursorY,
    size: PDF_META_FONT_SIZE,
    font: regularFont,
    color: rgb(0.07, 0.07, 0.07),
  })

  return cursorY - PDF_HEADER_GAP
}

const buildColumnWidths = (maxLaps: number) => {
  const availableWidth = PDF_PAGE_WIDTH - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT
  const fixedWidth = 36 + 140 + 56 + 56 + 64
  const lapWidth = maxLaps > 0 ? Math.max(40, (availableWidth - fixedWidth) / maxLaps) : 0

  const widths = [36, 140, 56]
  for (let index = 0; index < maxLaps; index += 1) {
    widths.push(lapWidth)
  }
  widths.push(56, 64)

  const total = widths.reduce((sum, width) => sum + width, 0)
  const delta = availableWidth - total
  widths[1] += delta
  return widths
}

const drawTableHeader = (
  page: PDFPage,
  font: PDFFont,
  startY: number,
  columnWidths: number[],
  maxLaps: number,
) => {
  const labels = ['№', 'Фамилия', 'Старт']
  for (let index = 0; index < maxLaps; index += 1) {
    labels.push(`Круг ${index + 1}`)
  }
  labels.push('Финиш', 'Чистое время')

  let currentX = PDF_MARGIN_LEFT
  const headerY = startY - PDF_TABLE_HEADER_HEIGHT
  for (let index = 0; index < labels.length; index += 1) {
    const width = columnWidths[index]
    page.drawRectangle({
      x: currentX,
      y: headerY,
      width,
      height: PDF_TABLE_HEADER_HEIGHT,
      borderWidth: 1,
      borderColor: rgb(0.07, 0.07, 0.07),
      color: rgb(0.96, 0.96, 0.96),
    })
    const label = labels[index]
    const textWidth = measureTextWidth(font, label, PDF_SMALL_FONT_SIZE)
    page.drawText(label, {
      x: currentX + Math.max(PDF_CELL_PADDING_X, (width - textWidth) / 2),
      y: headerY + 7,
      size: PDF_SMALL_FONT_SIZE,
      font,
      color: rgb(0.07, 0.07, 0.07),
    })
    currentX += width
  }

  return headerY
}

const drawParticipantRow = (
  page: PDFPage,
  regularFont: PDFFont,
  participant: ProtocolRecord['participants'][number],
  topY: number,
  columnWidths: number[],
  maxLaps: number,
) => {
  const rowValues = [
    String(participant.number),
    participant.lastName,
    formatSec(participant.startTimeSec),
  ]

  for (let lapIndex = 0; lapIndex < maxLaps; lapIndex += 1) {
    const lap = participant.lapTimes.find((item) => item.lapIndex === lapIndex)
    rowValues.push(formatSec(lap?.lapTimeSec ?? null))
  }

  rowValues.push(
    participant.dsq ? 'DSQ' : formatSec(participant.finishTimeSec),
    participant.dsq ? 'DSQ' : formatSec(participant.netTimeSec),
  )

  const linesPerCell = rowValues.map((value, index) => {
    if (index === 1) {
      return wrapPdfText(
        regularFont,
        value,
        PDF_FONT_SIZE,
        columnWidths[index] - PDF_CELL_PADDING_X * 2,
      )
    }
    return [value]
  })

  const rowHeight = Math.max(
    PDF_ROW_MIN_HEIGHT,
    ...linesPerCell.map((lines) => lines.length * PDF_LINE_HEIGHT + PDF_CELL_PADDING_Y * 2),
  )
  const rowBottomY = topY - rowHeight

  let currentX = PDF_MARGIN_LEFT
  for (let index = 0; index < rowValues.length; index += 1) {
    const width = columnWidths[index]
    page.drawRectangle({
      x: currentX,
      y: rowBottomY,
      width,
      height: rowHeight,
      borderWidth: 1,
      borderColor: rgb(0.07, 0.07, 0.07),
    })

    const lines = linesPerCell[index]
    const isLeftAligned = index === 1
    let textY = topY - PDF_CELL_PADDING_Y - PDF_FONT_SIZE
    for (const line of lines) {
      const fittedLine = trimToFit(
        regularFont,
        line,
        PDF_FONT_SIZE,
        width - PDF_CELL_PADDING_X * 2,
      )
      const textWidth = measureTextWidth(regularFont, fittedLine, PDF_FONT_SIZE)
      const textX = isLeftAligned
        ? currentX + PDF_CELL_PADDING_X
        : currentX + Math.max(PDF_CELL_PADDING_X, (width - textWidth) / 2)

      page.drawText(fittedLine, {
        x: textX,
        y: textY,
        size: PDF_FONT_SIZE,
        font: regularFont,
        color: rgb(0.07, 0.07, 0.07),
      })
      textY -= PDF_LINE_HEIGHT
    }
    currentX += width
  }

  return rowBottomY
}

const drawPdf = async (record: ProtocolRecord) => {
  const pdfDocument = await PDFDocument.create()
  pdfDocument.registerFontkit(fontkit)
  const fontPath = resolvePdfFontPath()
  const fontBytes = readFileSync(fontPath)
  const regularFont = await pdfDocument.embedFont(fontBytes, { subset: true })
  const boldFont = regularFont

  const ordered = [...record.participants].sort((left, right) => left.sortOrder - right.sortOrder)
  const maxLaps = ordered.reduce((acc, participant) => Math.max(acc, participant.lapTimes.length), 0)
  const columnWidths = buildColumnWidths(maxLaps)
  const contentBottomY = PDF_MARGIN_BOTTOM + PDF_SIGNATURE_GAP

  let page = pdfDocument.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
  drawPageFooter(page, regularFont, record)
  let cursorY = drawProtocolHeader(page, regularFont, boldFont, record)
  cursorY = drawTableHeader(page, boldFont, cursorY, columnWidths, maxLaps)

  for (const participant of ordered) {
    const lastNameLines = wrapPdfText(
      regularFont,
      participant.lastName,
      PDF_FONT_SIZE,
      columnWidths[1] - PDF_CELL_PADDING_X * 2,
    )
    const estimatedRowHeight = Math.max(
      PDF_ROW_MIN_HEIGHT,
      lastNameLines.length * PDF_LINE_HEIGHT + PDF_CELL_PADDING_Y * 2,
    )

    if (cursorY - estimatedRowHeight < contentBottomY) {
      page = pdfDocument.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
      drawPageFooter(page, regularFont, record)
      cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP
      cursorY = drawTableHeader(page, boldFont, cursorY, columnWidths, maxLaps)
    }

    cursorY = drawParticipantRow(page, regularFont, participant, cursorY, columnWidths, maxLaps)
  }

  const bytes = await pdfDocument.save()
  return Buffer.from(bytes)
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
