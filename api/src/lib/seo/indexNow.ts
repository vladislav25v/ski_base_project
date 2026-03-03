import { env } from '../../config/env.js'

const SITE_URL = env.siteUrl.replace(/\/+$/, '')
const INDEXNOW_KEY = env.indexNowKey.trim()
const INDEXNOW_ENDPOINT = env.indexNowEndpoint
const INDEXNOW_KEY_LOCATION = INDEXNOW_KEY ? `${SITE_URL}/${INDEXNOW_KEY}.txt` : ''

const buildNewsUrl = (newsId: number) => `${SITE_URL}/news/${newsId}`

export const getIndexNowKeyFileRoute = () => {
  if (!INDEXNOW_KEY) {
    return null
  }
  return {
    path: `/${INDEXNOW_KEY}.txt`,
    value: INDEXNOW_KEY,
  }
}

export const submitIndexNowNewsUrl = async (newsId: number) => {
  if (!INDEXNOW_KEY) {
    return
  }

  const payload = {
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: [buildNewsUrl(newsId)],
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`IndexNow request failed with status ${response.status}`)
  }
}
