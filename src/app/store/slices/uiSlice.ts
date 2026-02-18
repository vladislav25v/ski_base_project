import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

export type ThemeMode = 'light' | 'dark'

type UiState = {
  menuOpen: boolean
  theme: ThemeMode
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem('theme')
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme
  }

  return document.body.dataset.theme === 'dark' ? 'dark' : 'light'
}

const initialState: UiState = {
  menuOpen: false,
  theme: getInitialTheme(),
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
      state.theme = action.payload
    },
  },
})

export const { openMenu, closeMenu, toggleMenu, setTheme } = uiSlice.actions
export const uiReducer = uiSlice.reducer

export const selectMenuOpen = (state: RootState) => state.ui.menuOpen
export const selectTheme = (state: RootState) => state.ui.theme
