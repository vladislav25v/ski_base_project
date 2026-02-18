import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

export type AuthUser = {
  id: string
  email: string
  role: string
}

type AuthState = {
  user: AuthUser | null
}

const USER_KEY = 'authUser'

const readStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

const writeStoredUser = (user: AuthUser | null) => {
  if (typeof window === 'undefined') {
    return
  }

  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user))
    return
  }

  window.localStorage.removeItem(USER_KEY)
}

const initialState: AuthState = {
  user: readStoredUser(),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload
      writeStoredUser(action.payload)
    },
    clearAuthUser: (state) => {
      state.user = null
      writeStoredUser(null)
    },
  },
})

export const { setAuthUser, clearAuthUser } = authSlice.actions
export const authReducer = authSlice.reducer

export const selectAuthUser = (state: RootState) => state.auth.user
export const selectIsAdmin = (state: RootState) => state.auth.user?.role === 'admin'
