import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

export type Theme = 'light' | 'dark'
export type ThemeMode = Theme | 'system'

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

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const isModeLocked = window.localStorage.getItem('theme-mode-locked') === '1'
  const storedMode = window.localStorage.getItem('theme-mode')
  if (
    isModeLocked &&
    (storedMode === 'dark' || storedMode === 'light' || storedMode === 'system')
  ) {
    if (storedMode === 'system') {
      return 'system'
    }

    // Unlock when persisted explicit mode already matches current system theme.
    // This lets OS preference drive the UI again without overriding opposite manual choice.
    return storedMode === getSystemTheme() ? 'system' : storedMode
  }

  return 'system'
}

const initialThemeMode = getInitialThemeMode()

const initialState: UiState = {
  menuOpen: false,
  themeMode: initialThemeMode,
  theme: initialThemeMode === 'system' ? getSystemTheme() : initialThemeMode,
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
      if (action.payload === 'system') {
        state.themeMode = 'system'
        state.theme = getSystemTheme()
        return
      }

      state.theme = action.payload
      state.themeMode = action.payload === getSystemTheme() ? 'system' : action.payload
    },
    syncSystemTheme: (state, action: PayloadAction<Theme>) => {
      if (state.themeMode === 'system') {
        state.theme = action.payload
      }
    },
  },
})

export const { openMenu, closeMenu, toggleMenu, setTheme, syncSystemTheme } = uiSlice.actions
export const uiReducer = uiSlice.reducer

export const selectMenuOpen = (state: RootState) => state.ui.menuOpen
export const selectTheme = (state: RootState) => state.ui.theme
export const selectThemeMode = (state: RootState) => state.ui.themeMode
