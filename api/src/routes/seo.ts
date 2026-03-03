import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import { env } from '../config/env.js'

const router = Router()

const SITE_URL = env.siteUrl.replace(/\/+$/, '')

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const toNewsUrl = (id: number) => `${SITE_URL}/news/${id}`

router.get('/sitemap-news.xml', async (_req, res) => {
  try {
    const items = await prisma.news.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, updatedAt: true },
    })

    const body = items
      .map((item) => {
        const lastmod = (item.updatedAt ?? item.createdAt).toISOString()
        return [
          '  <url>',
          `    <loc>${escapeXml(toNewsUrl(item.id))}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '  </url>',
        ].join('\n')
      })
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`

    res.type('application/xml; charset=utf-8')
    return res.send(xml)
  } catch (error) {
    console.error('Failed to build sitemap-news.xml', error)
    return res.status(500).type('text/plain; charset=utf-8').send('Failed to build sitemap')
  }
})

router.get('/rss.xml', async (_req, res) => {
  try {
    const items = await prisma.news.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, text: true, createdAt: true, updatedAt: true },
    })

    const latestBuildDate = items[0]?.updatedAt ?? new Date()
    const xmlItems = items
      .map((item) => {
        const title = escapeXml(item.title)
        const description = escapeXml(item.text.length > 300 ? `${item.text.slice(0, 300)}...` : item.text)
        const link = escapeXml(toNewsUrl(item.id))
        const guid = link
        return [
          '  <item>',
          `    <title>${title}</title>`,
          `    <link>${link}</link>`,
          `    <guid isPermaLink="true">${guid}</guid>`,
          `    <pubDate>${item.createdAt.toUTCString()}</pubDate>`,
          `    <description>${description}</description>`,
          '  </item>',
        ].join('\n')
      })
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Новости лыжной базы г. Тында</title>
  <link>${escapeXml(SITE_URL)}</link>
  <description>Лента обновлений новостей лыжной базы</description>
  <language>ru-RU</language>
  <lastBuildDate>${latestBuildDate.toUTCString()}</lastBuildDate>
${xmlItems}
</channel>
</rss>`

    res.type('application/xml; charset=utf-8')
    return res.send(xml)
  } catch (error) {
    console.error('Failed to build rss.xml', error)
    return res.status(500).type('text/plain; charset=utf-8').send('Failed to build rss')
  }
})

export { router as seoRouter }
