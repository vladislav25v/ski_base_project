import { z } from 'zod'

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

const profileResponseSchema = z.object({
  id: z.string(),
  login: z.string().optional(),
  default_email: z.string().email().optional(),
  emails: z.array(z.string().email()).optional(),
  real_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  sex: z.string().optional(),
  birthday: z.string().optional(),
  default_avatar_id: z.string().optional(),
})

type ExchangeCodeParams = {
  code: string
  clientId: string
  clientSecret: string
}

export type YandexUserProfile = z.infer<typeof profileResponseSchema>

export const buildYandexAuthUrl = ({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string
  redirectUri: string
  state: string
}) => {
  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

export const exchangeYandexCode = async ({
  code,
  clientId,
  clientSecret,
}: ExchangeCodeParams) => {
  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  })

  if (!response.ok) {
    throw new Error(`Yandex token exchange failed: ${response.status}`)
  }

  const json = await response.json()
  const parsed = tokenResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Yandex token payload is invalid')
  }

  return parsed.data.access_token
}

export const fetchYandexProfile = async (accessToken: string): Promise<YandexUserProfile> => {
  const response = await fetch('https://login.yandex.ru/info?format=json', {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Yandex profile request failed: ${response.status}`)
  }

  const json = await response.json()
  const parsed = profileResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Yandex profile payload is invalid')
  }

  return parsed.data
}

export const resolveProfileEmail = (profile: YandexUserProfile) => {
  const primary = profile.default_email?.trim().toLowerCase()
  if (primary) {
    return primary
  }
  const fallback = profile.emails?.find(Boolean)?.trim().toLowerCase()
  return fallback || null
}
