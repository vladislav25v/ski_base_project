const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const MEDIA_BASE_URL =
  (import.meta.env.VITE_MEDIA_URL as string | undefined)?.replace(/\/$/, '') ??
  (API_BASE_URL ? `${API_BASE_URL}/storage` : '')

type ApiError = {
  message: string
  status?: number
}

const buildUrl = (path: string) => {
  if (path.startsWith('http')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

const parseJson = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const request = async <T>(path: string, options: RequestInit, isJson = true) => {
  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      credentials: 'include',
      headers: {
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers ?? {}),
      },
    })

    const payload = (await parseJson(response)) as T | null
    if (!response.ok) {
      const message = (payload as { error?: string } | null)?.error ?? response.statusText
      const error: ApiError = { message, status: response.status }
      return { data: null as T | null, error }
    }

    return { data: payload, error: null as ApiError | null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error'
    return { data: null as T | null, error: { message } }
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }, false),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }, false),
  upload: <T>(path: string, body: FormData) =>
    request<T>(path, { method: 'POST', body }, false),
}

export const getMediaPublicUrl = (path: string) => {
  if (!MEDIA_BASE_URL) {
    return ''
  }
  return `${MEDIA_BASE_URL}/${path.replace(/^\/+/, '')}`
}
