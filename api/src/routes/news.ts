import { Router } from 'express'
import multer from 'multer'
import { env } from '../config/env.js'
import { prisma } from '../db/prisma.js'
import { renderNewsHtml, renderNotFoundNewsHtml, resolveResponseFormat } from '../lib/seo/newsSsr.js'
import { requireAdmin } from '../middleware/auth.js'
import { buildPublicUrl, getStoragePathFromUrl, removeFileSafe, uploadImage } from '../storage/index.js'

const router = Router()

const IMAGE_DIR = 'news_pictures'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const SITEMAP_URL = `${env.siteUrl.replace(/\/+$/, '')}/sitemap.xml`

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

const pingSitemap = () => {
  const encodedSitemapUrl = encodeURIComponent(SITEMAP_URL)
  const pingUrls = [
    `https://www.google.com/ping?sitemap=${encodedSitemapUrl}`,
    `https://yandex.com/ping?sitemap=${encodedSitemapUrl}`,
  ]

  void Promise.allSettled(
    pingUrls.map(async (url) => {
      const response = await fetch(url, { method: 'GET' })
      if (!response.ok) {
        throw new Error(`Ping failed (${response.status}) for ${url}`)
      }
    }),
  ).then((results) => {
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.warn('Sitemap ping error', result.reason)
      }
    })
  })
}

router.get('/', async (req, res) => {
  const limit = Number(req.query.limit)
  const take = Number.isFinite(limit) && limit > 0 ? limit : undefined

  try {
    const items = await prisma.news.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    })

    return res.json({
      items: items.map((item: (typeof items)[number]) => {
        const imageUrl = item.imageUrl
          ? item.imageUrl.startsWith('http')
            ? item.imageUrl
            : buildPublicUrl(item.imageUrl)
          : null
        const updatedAt = (item as { updatedAt?: Date }).updatedAt ?? item.createdAt
        return {
          id: item.id,
          createdAt: item.createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          title: item.title,
          text: item.text,
          imageUrl,
        }
      }),
    })
  } catch (error) {
    console.error('Failed to load news', error)
    return res.status(500).json({ error: 'Failed to load news' })
  }
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  try {
    const item = await prisma.news.findUnique({ where: { id } })
    const format = resolveResponseFormat(
      typeof req.query.format === 'string' ? req.query.format : undefined,
      String(req.headers.accept ?? ''),
    )

    if (!item) {
      if (format === 'json') {
        return res.status(404).json({ error: 'Not found' })
      }
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      res.status(404).type('text/html; charset=utf-8')
      return res.send(renderNotFoundNewsHtml())
    }

    const imageUrl = item.imageUrl
      ? item.imageUrl.startsWith('http')
        ? item.imageUrl
        : buildPublicUrl(item.imageUrl)
      : null

    if (format === 'html') {
      res.type('text/html; charset=utf-8')
      return res.send(
        renderNewsHtml({
          id: item.id,
          title: item.title,
          text: item.text,
          createdAt: item.createdAt,
          imageUrl,
        }),
      )
    }

    return res.json({
      item: {
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        updatedAt: ((item as { updatedAt?: Date }).updatedAt ?? item.createdAt).toISOString(),
        title: item.title,
        text: item.text,
        imageUrl,
      },
    })
  } catch (error) {
    console.error('Failed to load news item', error)
    return res.status(500).json({ error: 'Failed to load news item' })
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

  let previousImageKey: string | null = null
  if (typeof id === 'number') {
    const existing = await prisma.news.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Not found' })
    }
    previousImageKey = existing.imageUrl
  }

  let newImageKey = previousImageKey
  let uploadedPath: string | null = null

  if (req.file) {
    const uploadResult = await uploadImage(IMAGE_DIR, req.file)
    uploadedPath = uploadResult.key
    newImageKey = uploadResult.key
  } else if (removeImage) {
    newImageKey = null
  }

  try {
    const payload = { title, text, imageUrl: newImageKey }
    const data =
      typeof id === 'number'
        ? await prisma.news.update({ where: { id }, data: payload })
        : await prisma.news.create({ data: payload })

    if (previousImageKey && (removeImage || (newImageKey && newImageKey !== previousImageKey))) {
      const previousPath =
        getStoragePathFromUrl(previousImageKey) ??
        (previousImageKey.startsWith('http') ? null : previousImageKey)
      await removeFileSafe(previousPath)
    }

    const imageUrl = data.imageUrl
      ? data.imageUrl.startsWith('http')
        ? data.imageUrl
        : buildPublicUrl(data.imageUrl)
      : null

    pingSitemap()

    return res.json({
      item: {
        id: data.id,
        createdAt: data.createdAt.toISOString(),
        updatedAt: ((data as { updatedAt?: Date }).updatedAt ?? data.createdAt).toISOString(),
        title: data.title,
        text: data.text,
        imageUrl,
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

  const imagePath = existing.imageUrl
    ? getStoragePathFromUrl(existing.imageUrl) ??
      (existing.imageUrl.startsWith('http') ? null : existing.imageUrl)
    : null
  if (imagePath) {
    await removeFileSafe(imagePath)
  }

  await prisma.news.delete({ where: { id } })
  pingSitemap()
  return res.json({ success: true })
})

export { router as newsRouter }
