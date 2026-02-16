import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { getStoragePathFromUrl, removeFileSafe, uploadImage } from '../storage/index.js'

const router = Router()

const IMAGE_DIR = 'news_pictures'
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

router.get('/', async (req, res) => {
  const limit = Number(req.query.limit)
  const take = Number.isFinite(limit) && limit > 0 ? limit : undefined

  try {
    const items = await prisma.news.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    })

    return res.json({
      items: items.map((item: typeof items[number]) => ({
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        title: item.title,
        text: item.text,
        imageUrl: item.imageUrl,
      })),
    })
  } catch (error) {
    console.error('Failed to load news', error)
    return res.status(500).json({ error: 'Failed to load news' })
  }
})

router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  const title = String(req.body.title ?? '').trim()
  const text = String(req.body.text ?? '').trim()
  const idRaw = req.body.id
  const removeImage = String(req.body.remove_image ?? '') === 'true'

  if (!title) {
    return res.status(400).json({ error: 'Missing title' })
  }
  if (!text) {
    return res.status(400).json({ error: 'Missing text' })
  }

  const id = idRaw ? Number(idRaw) : null
  if (idRaw && (!Number.isFinite(id) || id === null)) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  let previousImageUrl: string | null = null
  if (typeof id === 'number') {
    const existing = await prisma.news.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Not found' })
    }
    previousImageUrl = existing.imageUrl
  }

  let newImageUrl = previousImageUrl
  let uploadedPath: string | null = null

  if (req.file) {
    const uploadResult = await uploadImage(IMAGE_DIR, req.file)
    uploadedPath = uploadResult.key
    newImageUrl = uploadResult.publicUrl
  } else if (removeImage) {
    newImageUrl = null
  }

  try {
    const payload = { title, text, imageUrl: newImageUrl }
    const data = typeof id === 'number'
      ? await prisma.news.update({ where: { id }, data: payload })
      : await prisma.news.create({ data: payload })

    if (previousImageUrl && (removeImage || (newImageUrl && newImageUrl !== previousImageUrl))) {
      const previousPath = getStoragePathFromUrl(previousImageUrl)
      await removeFileSafe(previousPath)
    }

    return res.json({
      item: {
        id: data.id,
        createdAt: data.createdAt.toISOString(),
        title: data.title,
        text: data.text,
        imageUrl: data.imageUrl,
      },
    })
  } catch (error) {
    if (uploadedPath) {
      await removeFileSafe(uploadedPath)
    }
    const message = error instanceof Error ? error.message : 'Save failed'
    return res.status(400).json({ error: message })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  const existing = await prisma.news.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ error: 'Not found' })
  }

  const imagePath = existing.imageUrl ? getStoragePathFromUrl(existing.imageUrl) : null
  if (imagePath) {
    await removeFileSafe(imagePath)
  }

  await prisma.news.delete({ where: { id } })
  return res.json({ success: true })
})

export { router as newsRouter }
