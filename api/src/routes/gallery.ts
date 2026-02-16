import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { buildPublicUrl, removeFileSafe, uploadImage } from '../storage/index.js'

const router = Router()

const IMAGE_DIR = 'gallery'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Invalid file type'))
    }
    return cb(null, true)
  },
})

const metaSchema = z.array(
  z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    blurhash: z.string(),
    caption: z.string().nullable().optional(),
  }),
)

router.get('/', async (_req, res) => {
  const items = await prisma.galleryPicture.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return res.json({
    items: items.map((item: typeof items[number]) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      storagePath: item.storagePath,
      caption: item.caption,
      width: item.width,
      height: item.height,
      blurhash: item.blurhash,
      publicUrl: buildPublicUrl(item.storagePath),
    })),
  })
})

router.post('/', requireAdmin, upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? []
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files provided' })
  }

  let metaList: Array<{
    width: number
    height: number
    blurhash: string
    caption?: string | null
  }> = []

  const metaRaw = String(req.body.meta ?? '[]')
  try {
    const parsedMeta = metaSchema.safeParse(JSON.parse(metaRaw))
    if (parsedMeta.success) {
      metaList = parsedMeta.data
    }
  } catch {
    metaList = []
  }

  const createdItems = [] as Array<{
    id: string
    createdAt: string
    storagePath: string
    caption: string | null
    width: number | null
    height: number | null
    blurhash: string | null
  }>
  const uploadedKeys: string[] = []

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const uploadResult = await uploadImage(IMAGE_DIR, file)
      const storagePath = uploadResult.key
      uploadedKeys.push(storagePath)
      const meta = metaList[index]

      const record = await prisma.galleryPicture.create({
        data: {
          storagePath,
          caption: meta?.caption ?? null,
          width: meta?.width ?? null,
          height: meta?.height ?? null,
          blurhash: meta?.blurhash ?? null,
        },
      })

      createdItems.push({
        id: record.id,
        createdAt: record.createdAt.toISOString(),
        storagePath: record.storagePath,
        caption: record.caption,
        width: record.width,
        height: record.height,
        blurhash: record.blurhash,
      })
    }
  } catch (error) {
    await Promise.all(
      uploadedKeys.map((key) => removeFileSafe(key)),
    )
    const message = error instanceof Error ? error.message : 'Insert failed'
    return res.status(400).json({ error: message })
  }

  return res.json({ items: createdItems })
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  if (!id) {
    return res.status(400).json({ error: 'Missing id' })
  }

  const existing = await prisma.galleryPicture.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ error: 'Not found' })
  }

  await removeFileSafe(existing.storagePath)
  await prisma.galleryPicture.delete({ where: { id } })

  return res.json({ success: true })
})

export { router as galleryRouter }
