import { env } from '../../config/env.js'

type NewsSsrPayload = {
  id: number
  title: string
  text: string
  createdAt: Date
  imageUrl: string | null
}

const SITE_URL = env.siteUrl.replace(/\/+$/, '')
const FRONT_SITE_URL = env.frontSiteUrl.replace(/\/+$/, '')
const FALLBACK_IMAGE_URL = `${SITE_URL}/preview.jpg`
const MAX_DESCRIPTION_LENGTH = 170

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const toPlainText = (value: string) => value.replace(/\s+/g, ' ').trim()

const trimDescription = (value: string) => {
  if (value.length <= MAX_DESCRIPTION_LENGTH) {
    return value
  }
  return `${value.slice(0, MAX_DESCRIPTION_LENGTH)}...`
}

const safeUrl = (value: string | null | undefined, fallback: string) => {
  if (!value) {
    return fallback
  }
  try {
    const parsed = new URL(value, SITE_URL)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback
    }
    return parsed.toString()
  } catch {
    return fallback
  }
}

const toBodyHtml = (text: string) => escapeHtml(text).replace(/\n/g, '<br />')

export const renderNewsHtml = (payload: NewsSsrPayload) => {
  const canonicalUrl = `${SITE_URL}/news/${payload.id}`
  const allNewsUrl = `${FRONT_SITE_URL}/news`
  const safeTitle = escapeHtml(payload.title.trim())
  const description = trimDescription(toPlainText(payload.text))
  const safeDescription = escapeHtml(description)
  const safeImage = escapeHtml(safeUrl(payload.imageUrl, FALLBACK_IMAGE_URL))
  const safeOgImageAlt = escapeHtml(`Фото к новости: ${payload.title.trim()}`)
  const safeDateLabel = escapeHtml(
    payload.createdAt.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  )
  const safeTextHtml = toBodyHtml(payload.text)

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle} | Лыжная база г. Тында</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeOgImageAlt}" />
    <style>
      :root {
        color-scheme: light;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      }
      body {
        margin: 0;
        background: #f5f7fa;
        color: #101926;
      }
      main {
        max-width: 860px;
        margin: 40px auto;
        padding: 0 16px 40px;
      }
      article {
        background: #fff;
        border: 1px solid #d6dde8;
        border-radius: 16px;
        padding: 24px;
      }
      h1 {
        margin: 0 0 12px;
        line-height: 1.2;
      }
      time {
        display: inline-block;
        margin-bottom: 16px;
        color: #5a687a;
        font-size: 14px;
      }
      img {
        width: 100%;
        height: auto;
        border-radius: 12px;
        border: 1px solid #d6dde8;
        margin-bottom: 16px;
      }
      p {
        margin: 0;
        line-height: 1.65;
        white-space: normal;
      }
      .back {
        display: inline-block;
        margin-bottom: 16px;
        color: #0f4c81;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <a class="back" href="${allNewsUrl}">Все новости</a>
      <article>
        <h1>${safeTitle}</h1>
        <time datetime="${payload.createdAt.toISOString()}">${safeDateLabel}</time>
        ${payload.imageUrl ? `<img src="${safeImage}" alt="${safeOgImageAlt}" />` : ''}
        <p>${safeTextHtml}</p>
      </article>
    </main>
  </body>
</html>`
}

export const renderNotFoundNewsHtml = () => {
  const allNewsUrl = `${FRONT_SITE_URL}/news`
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Новость не найдена</title>
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body>
    <main>
      <h1>Новость не найдена</h1>
      <p>Проверьте ссылку или вернитесь к списку новостей.</p>
      <a href="${allNewsUrl}">Все новости</a>
    </main>
  </body>
</html>`
}

export const resolveResponseFormat = (requestFormat: string | undefined, acceptHeader: string) => {
  if (requestFormat === 'json') {
    return 'json'
  }
  if (requestFormat === 'html') {
    return 'html'
  }
  if (acceptHeader.includes('application/json')) {
    return 'json'
  }
  return 'html'
}
