import { apiClient } from './apiClient'

export type AuthUser = {
  id: string
  email: string
  role: string
}

const USER_KEY = 'authUser'
const authEvents = new EventTarget()

const getLocalStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

const notify = () => {
  authEvents.dispatchEvent(new Event('change'))
}

export const getAuthUser = (): AuthUser | null => {
  const storage = getLocalStorage()
  const raw = storage?.getItem(USER_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export const setAuthUser = (user: AuthUser) => {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }
  storage.setItem(USER_KEY, JSON.stringify(user))
  notify()
}

export const clearAuthUser = () => {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }
  storage.removeItem(USER_KEY)
  notify()
}

export const syncAuthUser = async () => {
  const { data, error } = await apiClient.get<{ user: AuthUser }>('/auth/me')
  if (error || !data?.user) {
    clearAuthUser()
    return null
  }
  setAuthUser(data.user)
  return data.user
}

export const subscribeAuth = (handler: (user: AuthUser | null) => void) => {
  const listener = () => handler(getAuthUser())
  authEvents.addEventListener('change', listener)
  return () => authEvents.removeEventListener('change', listener)
}
