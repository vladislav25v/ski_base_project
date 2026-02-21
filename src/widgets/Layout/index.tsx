import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useGetMeQuery, useLogoutMutation } from '../../app/store/apiSlice'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { clearAuthUser, selectIsAdmin, setAuthUser } from '../../app/store/slices/authSlice'
import {
  closeMenu,
  selectMenuOpen,
  selectTheme,
  selectThemeMode,
  setTheme,
  toggleMenu,
} from '../../app/store/slices/uiSlice'
import { applyRouteSeo } from '../../shared/lib'
import { LoaderFallbackDots } from '../../shared/ui'
import { Header } from '../Header'
import { Menu } from '../Menu'
import { Footer } from '../footer'
import styles from './Layout.module.scss'

export const Layout = () => {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const menuOpen = useAppSelector(selectMenuOpen)
  const theme = useAppSelector(selectTheme)
  const themeMode = useAppSelector(selectThemeMode)
  const isAdmin = useAppSelector(selectIsAdmin)
  const { data: meUser, isSuccess: isMeSuccess, isError: isMeError } = useGetMeQuery()
  const [logout] = useLogoutMutation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    document.body.dataset.theme = theme
    document.body.dataset.themeMode = themeMode
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.themeMode = themeMode
    localStorage.setItem('theme-mode', themeMode)
  }, [theme, themeMode])

  useEffect(() => {
    applyRouteSeo(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    if (isMeSuccess && meUser) {
      dispatch(setAuthUser(meUser))
      return
    }
    if (isMeError) {
      dispatch(clearAuthUser())
    }
  }, [dispatch, isMeError, isMeSuccess, meUser])

  const handleMenuClose = () => {
    dispatch(closeMenu())
  }

  const handleLogout = () => {
    dispatch(clearAuthUser())
    void logout()
  }

  return (
    <div className={styles.layout}>
      <Header
        menuOpen={menuOpen}
        onMenuToggle={() => dispatch(toggleMenu())}
      />
      <Menu isOpen={menuOpen} onClose={handleMenuClose} intro={isHome} />
      <main className={styles.main}>
        <Suspense fallback={<LoaderFallbackDots />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer
        isAdmin={isAdmin}
        onLogout={handleLogout}
        theme={theme}
        onThemeChange={(checked) => dispatch(setTheme(checked ? 'dark' : 'light'))}
      />
    </div>
  )
}
