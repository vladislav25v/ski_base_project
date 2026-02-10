import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Toggle, getButtonClassName } from '../../shared/ui'
import { supabase } from '../../shared/lib'
import { Header } from '../Header'
import { Menu } from '../Menu'
import styles from './Layout.module.scss'

export const Layout = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    return (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light'
  })

  const adminUid = import.meta.env.VITE_ADMIN_UID as string | undefined
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
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }
      const user = data.session?.user
      setIsAdmin(!!(adminUid && user?.id === adminUid))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      setIsAdmin(!!(adminUid && user?.id === adminUid))
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [adminUid])

  const handleMenuClose = () => {
    setMenuOpen(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className={styles.layout}>
      <Header menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((open) => !open)} />
      <Menu isOpen={menuOpen} onClose={handleMenuClose} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        {isAdmin ? (
          <button
            className={getButtonClassName({ uppercase: true })}
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        ) : (
          <Link className={getButtonClassName({ uppercase: true })} to="/login">
            Admin Login
          </Link>
        )}
        <Toggle
          className={styles.themeToggle}
          checked={theme === 'dark'}
          labelLeft="Light"
          labelRight="Dark"
          onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        />
      </footer>
    </div>
  )
}
