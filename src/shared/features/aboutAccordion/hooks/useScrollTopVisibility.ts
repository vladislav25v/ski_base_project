import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export const useScrollTopVisibility = (targetRef: RefObject<HTMLElement | null>) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const target = targetRef.current
    if (!target) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      const onScroll = () => {
        const rect = target.getBoundingClientRect()
        setIsVisible(rect.bottom < 0 || rect.top > window.innerHeight)
      }

      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting)
      },
      { threshold: 0.05 },
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [targetRef])

  return isVisible
}
