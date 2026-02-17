import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  apiClient,
  applyRouteSeo,
  clearAuthUser,
  getAuthUser,
  subscribeAuth,
  syncAuthUser,
} from '../../shared/lib'
import { Header } from '../Header'
import { Menu } from '../Menu'
import { Footer } from '../footer'
import styles from './Layout.module.scss'

export const Layout = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    return (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light'
  })

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    applyRouteSeo(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    const updateAdmin = () => {
      const user = getAuthUser()
      setIsAdmin(user?.role === 'admin')
    }

    updateAdmin()
    const unsubscribe = subscribeAuth(updateAdmin)
    void syncAuthUser()
    return () => {
      unsubscribe()
    }
  }, [])

  const handleMenuClose = () => {
    setMenuOpen(false)
  }

  const handleLogout = () => {
    clearAuthUser()
    void apiClient.post('/auth/logout', {})
  }

  return (
    <div className={styles.layout}>
      <Header
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        theme={theme}
        onThemeChange={(checked) => setTheme(checked ? 'dark' : 'light')}
      />
      <Menu isOpen={menuOpen} onClose={handleMenuClose} intro={isHome} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer isAdmin={isAdmin} onLogout={handleLogout} />
    </div>
  )
}
