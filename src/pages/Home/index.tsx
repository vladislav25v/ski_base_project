import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Link } from 'react-router-dom'
import { useGetGalleryQuery, useGetNewsQuery } from '../../app/store/apiSlice'
import { useAppSelector } from '../../app/store/hooks'
import { selectTheme } from '../../app/store/slices/uiSlice'
import { getRtkErrorMessage } from '../../shared/lib/rtkQuery'
import type { NewsItem } from '../../shared/model'
import { NewsCard } from '../../shared/features/news/NewsCard'
import { ScheduleSection } from '../../shared/features/schedule'
import { TrainingScheduleSection } from '../../shared/features/trainingSchedule'
import { shuffleItems } from '../../shared/features/gallery/utils'
import styles from './Home.module.scss'

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'
const INTRO_IMAGE_PATH = '/intro.jpg'
const INTRO_IMAGE_ALT = 'Лыжная база'
const HERO_SWITCH_INTERVAL_MS = 10000
const HERO_FADE_DURATION_MS = 1000
const loadHomeHighlights = () => import('../../shared/features/homeHighlights')
const HomeHighlights = lazy(() =>
  loadHomeHighlights().then((module) => ({ default: module.HomeHighlights })),
)

type HeroImage = {
  url: string
  alt: string
  galleryIndex: number | null
}

const HighlightsBlockLoader = ({ theme }: { theme: string }) => {
  const loaderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!loaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: loaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: theme === 'dark' ? LOADER_ANIMATION_YELLOW_PATH : LOADER_ANIMATION_DEFAULT_PATH,
    })

    return () => {
      animation.destroy()
    }
  }, [theme])

  return (
    <div className={styles.highlightsPlaceholder} role="status" aria-live="polite">
      <div className={styles.highlightsLoaderAnimation} ref={loaderRef} />
    </div>
  )
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

const getPreviewText = (text: string) => {
  const trimmed = text.trim()
  if (trimmed.length <= 180) {
    return trimmed
  }
  return `${trimmed.slice(0, 180)}...`
}

const getRandomIndex = (length: number, exclude: number) => {
  if (length <= 1) {
    return 0
  }

  let nextIndex = exclude
  while (nextIndex === exclude) {
    nextIndex = Math.floor(Math.random() * length)
  }

  return nextIndex
}

export const HomePage = () => {
  const [currentHeroImage, setCurrentHeroImage] = useState<HeroImage>({
    url: INTRO_IMAGE_PATH,
    alt: INTRO_IMAGE_ALT,
    galleryIndex: null,
  })
  const [nextHeroImage, setNextHeroImage] = useState<HeroImage | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isMapInView, setIsMapInView] = useState(false)
  const [isHighlightsInView, setIsHighlightsInView] = useState(false)
  const theme = useAppSelector(selectTheme)
  const currentGalleryIndexRef = useRef<number | null>(null)
  const switchTimeoutRef = useRef<number | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const highlightsContainerRef = useRef<HTMLDivElement | null>(null)

  const {
    data: latestNewsItems = [],
    isLoading: isNewsLoading,
    isError: isNewsError,
    error: newsQueryError,
  } = useGetNewsQuery({ limit: 1 })
  const { data: galleryData = [] } = useGetGalleryQuery()

  const latestNews: NewsItem | null = latestNewsItems[0] ?? null

  const galleryItems = useMemo(
    () =>
      shuffleItems(
        galleryData
          .filter((item) => Boolean(item.publicUrl))
          .map((item) => ({
            url: item.publicUrl,
            alt: item.caption || 'Фотография из галереи',
          })),
      ),
    [galleryData],
  )

  const latestDate = useMemo(() => {
    if (!latestNews) {
      return ''
    }
    return formatDate(latestNews.createdAt)
  }, [latestNews])

  const mapWidgetSrc = useMemo(() => {
    const src = new URL('https://yandex.ru/map-widget/v1/')
    src.searchParams.set('ll', '124.703548,55.161825')
    src.searchParams.set('mode', 'poi')
    src.searchParams.set('poi[point]', '124.701973,55.160831')
    src.searchParams.set('poi[uri]', 'ymapsbm1://org?oid=186711668181')
    src.searchParams.set('z', '14')
    src.searchParams.set('theme', theme === 'dark' ? 'dark' : 'light')
    return src.toString()
  }, [theme])

  useEffect(() => {
    if (galleryItems.length === 0) {
      return
    }

    let isCanceled = false

    const clearTimers = () => {
      if (switchTimeoutRef.current !== null) {
        window.clearTimeout(switchTimeoutRef.current)
        switchTimeoutRef.current = null
      }
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
        transitionTimeoutRef.current = null
      }
    }

    const preloadImage = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const image = new Image()
        const clearHandlers = () => {
          image.onload = null
          image.onerror = null
        }

        image.onload = () => {
          clearHandlers()
          resolve()
        }
        image.onerror = () => {
          clearHandlers()
          reject(new Error('Failed to preload image'))
        }
        image.decoding = 'async'
        image.src = src
        if (image.complete) {
          clearHandlers()
          resolve()
        }
      })

    const pickRandomGalleryIndex = () => {
      const currentIndex = currentGalleryIndexRef.current
      if (galleryItems.length <= 1) {
        return 0
      }
      if (currentIndex === null) {
        return Math.floor(Math.random() * galleryItems.length)
      }
      return getRandomIndex(galleryItems.length, currentIndex)
    }

    const scheduleNextSwitch = () => {
      switchTimeoutRef.current = window.setTimeout(() => {
        const nextIndex = pickRandomGalleryIndex()
        const nextItem = galleryItems[nextIndex]
        if (!nextItem) {
          if (!isCanceled) {
            scheduleNextSwitch()
          }
          return
        }

        void preloadImage(nextItem.url)
          .then(() => {
            if (isCanceled) {
              return
            }

            setNextHeroImage({
              url: nextItem.url,
              alt: nextItem.alt,
              galleryIndex: nextIndex,
            })
            setIsTransitioning(true)

            transitionTimeoutRef.current = window.setTimeout(() => {
              if (isCanceled) {
                return
              }

              currentGalleryIndexRef.current = nextIndex
              setCurrentHeroImage({
                url: nextItem.url,
                alt: nextItem.alt,
                galleryIndex: nextIndex,
              })
              setNextHeroImage(null)
              setIsTransitioning(false)
              scheduleNextSwitch()
            }, HERO_FADE_DURATION_MS)
          })
          .catch(() => {
            if (!isCanceled) {
              scheduleNextSwitch()
            }
          })
      }, HERO_SWITCH_INTERVAL_MS)
    }

    scheduleNextSwitch()

    return () => {
      isCanceled = true
      clearTimers()
    }
  }, [galleryItems])

  useEffect(() => {
    if (isMapInView) {
      return
    }
    if (!mapContainerRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsMapInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '200px 0px',
      },
    )

    observer.observe(mapContainerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isMapInView])
  useEffect(() => {
    if (isHighlightsInView) {
      return
    }
    if (!highlightsContainerRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsHighlightsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '1400px 0px',
      },
    )

    observer.observe(highlightsContainerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isHighlightsInView])

  useEffect(() => {
    let timeoutId: number | null = null
    let idleId: number | null = null

    const preload = () => {
      void loadHomeHighlights()
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(preload, { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(preload, 300)
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  const newsError = isNewsError
    ? getRtkErrorMessage(newsQueryError, 'Не удалось загрузить новости.')
    : ''

  return (
    <section className={styles.page}>
      <div className={styles.logoGlow}>
        <img className={styles.logoMark} src="/logo.png" alt="Логотип лыжной базы" />
      </div>
      <div className={`${styles.hero} ${styles.contentWidth}`}>
        <img className={styles.heroImageTop} src="/preview.jpg" alt="Снег и лыжи" />
        <Link className={styles.heroLink} to="/gallery">
          <div className={styles.heroImageBottomFrame}>
            <div className={`${styles.heroImageLayer} ${isTransitioning ? styles.heroImageLeaving : ''}`}>
              <img
                className={styles.heroImageBottom}
                src={currentHeroImage.url}
                alt={currentHeroImage.alt}
                loading="eager"
                decoding="async"
              />
            </div>
            {isTransitioning && nextHeroImage ? (
              <div className={`${styles.heroImageLayer} ${styles.heroImageEntering}`}>
                <img
                  className={styles.heroImageBottom}
                  src={nextHeroImage.url}
                  alt={nextHeroImage.alt}
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : null}
          </div>
        </Link>
      </div>
      {isNewsLoading ? (
        <p className={styles.latestStatus}>{'Загрузка...'}</p>
      ) : newsError ? (
        <p className={styles.latestStatus}>{newsError}</p>
      ) : latestNews ? (
        <>
          <h2 className={styles.announcementTitle}>{'Объявление'}</h2>
          <NewsCard
            item={latestNews}
            dateLabel={latestDate}
            text={getPreviewText(latestNews.text)}
          />
        </>
      ) : (
        <p className={styles.latestStatus}>{'Пока нет новостей.'}</p>
      )}
      <TrainingScheduleSection title="График тренировки детей" titleLinkTo="/training" compact />
      <ScheduleSection
        title="График работы проката лыж"
        titleLinkTo="/rental"
        apiPath="/schedule"
        compact
      />
      <div className={styles.mapInfoSection}>
        <h2 className={styles.mapTitle}>Как добраться</h2>
        <div className={styles.mapInfo}>
          <p className={styles.mapText}>На автобусе №3 до остановки "улица Автомобилистов"</p>
        </div>
      </div>
      <div className={styles.mapContainer} ref={mapContainerRef}>
        {isMapInView ? (
          <iframe
            className={styles.mapFrame}
            src={mapWidgetSrc}
            loading="eager"
            allowFullScreen
            title="Лыжная база на карте"
          />
        ) : (
          <div className={styles.mapPlaceholder} aria-hidden="true" />
        )}
      </div>
      <div className={styles.highlightsContainer} ref={highlightsContainerRef}>
        {isHighlightsInView ? (
          <Suspense
            fallback={
              <HighlightsBlockLoader theme={theme} />
            }
          >
            <HomeHighlights cardsCount={1} />
          </Suspense>
        ) : (
          <div className={styles.highlightsPlaceholder} aria-hidden="true" />
        )}
      </div>
    </section>
  )
}
