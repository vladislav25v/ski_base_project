import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

export type Theme = 'light' | 'dark'
export type ThemeMode = Theme

type UiState = {
  menuOpen: boolean
  themeMode: ThemeMode
  theme: Theme
}

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const getInitialThemeMode = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedMode = window.localStorage.getItem('theme-mode')
  if (storedMode === 'dark' || storedMode === 'light') {
    return storedMode
  }

  const storedLegacyTheme = window.localStorage.getItem('theme')
  if (storedLegacyTheme === 'dark' || storedLegacyTheme === 'light') {
    return storedLegacyTheme
  }

  // System preference is used only once for initial switch position.
  return getSystemTheme()
}

const initialThemeMode = getInitialThemeMode()

const initialState: UiState = {
  menuOpen: false,
  themeMode: initialThemeMode,
  theme: initialThemeMode,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openMenu: (state) => {
      state.menuOpen = true
    },
    closeMenu: (state) => {
      state.menuOpen = false
    },
    toggleMenu: (state) => {
      state.menuOpen = !state.menuOpen
    },
    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload
      state.theme = action.payload
    },
  },
})

export const { openMenu, closeMenu, toggleMenu, setTheme } = uiSlice.actions
export const uiReducer = uiSlice.reducer

export const selectMenuOpen = (state: RootState) => state.ui.menuOpen
export const selectTheme = (state: RootState) => state.ui.theme
export const selectThemeMode = (state: RootState) => state.ui.themeMode
