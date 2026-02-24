import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { LoaderFallbackDots } from './LoaderFallbackDots'
import styles from './ThemeLoader.module.scss'

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'

type ThemeLoaderProps = {
  theme: 'light' | 'dark'
  className?: string
}

export const ThemeLoader = ({ theme, className }: ThemeLoaderProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [showFallback, setShowFallback] = useState(true)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: theme === 'dark' ? LOADER_ANIMATION_YELLOW_PATH : LOADER_ANIMATION_DEFAULT_PATH,
    })

    const handleLoaded = () => setShowFallback(false)
    const handleFailed = () => setShowFallback(true)

    animation.addEventListener('DOMLoaded', handleLoaded)
    animation.addEventListener('data_failed', handleFailed)

    return () => {
      animation.removeEventListener('DOMLoaded', handleLoaded)
      animation.removeEventListener('data_failed', handleFailed)
      animation.destroy()
    }
  }, [theme])

  return (
    <span className={`${styles.loader}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span ref={containerRef} className={styles.animation} />
      {showFallback ? <LoaderFallbackDots className={styles.fallback} /> : null}
    </span>
  )
}

