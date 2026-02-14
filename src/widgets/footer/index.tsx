import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Link } from 'react-router-dom'
import { getButtonClassName } from '../../shared/ui'
import styles from './Footer.module.scss'
import footerAnimation from '../../assets/loaders/animation1.json'
import footerAnimationYellow from '../../assets/loaders/animation_1_yellow.json'

type FooterProps = {
  isAdmin: boolean
  onLogout: () => void
}

export const Footer = ({ isAdmin, onLogout }: FooterProps) => {
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.body.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    if (!loaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: loaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: theme === 'dark' ? footerAnimationYellow : footerAnimation,
    })

    return () => {
      animation.destroy()
    }
  }, [theme])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.body.dataset.theme === 'dark' ? 'dark' : 'light')
    })

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <footer className={styles.footer}>
      {isAdmin ? (
        <button
          className={getButtonClassName({ uppercase: true })}
          type="button"
          onClick={onLogout}
        >
          Выйти
        </button>
      ) : (
        <Link className={getButtonClassName({ uppercase: true })} to="/admin">
          Кнопка директора
        </Link>
      )}
    </footer>
  )
}
