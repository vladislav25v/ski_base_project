import { useEffect, useMemo, useRef, useState } from 'react'
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
import { buildBlurDataUrl, shuffleItems } from '../../shared/features/gallery/utils'
import { LoaderFallbackDots } from '../../shared/ui'
import styles from './Home.module.scss'

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'

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
  const [loadedImageUrls, setLoadedImageUrls] = useState<Record<string, true>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const theme = useAppSelector(selectTheme)
  const randomLoaderRef = useRef<HTMLDivElement | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)

  const {
    data: latestNewsItems = [],
    isLoading: isNewsLoading,
    isError: isNewsError,
    error: newsQueryError,
  } = useGetNewsQuery({ limit: 1 })
  const { data: galleryData = [], isLoading: isGalleryLoading } = useGetGalleryQuery()

  const latestNews: NewsItem | null = latestNewsItems[0] ?? null
  const isRandomLoading = isGalleryLoading

  const galleryItems = useMemo(
    () =>
      shuffleItems(
        galleryData
          .filter((item) => Boolean(item.publicUrl))
          .map((item) => ({
            url: item.publicUrl,
            alt: item.caption || 'Фотография из галереи',
            blurhash: item.blurhash ?? null,
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

  const safeCurrentIndex = galleryItems.length > 0 ? currentIndex % galleryItems.length : 0
  const currentItem = galleryItems[safeCurrentIndex]
  const nextItem = nextIndex !== null && galleryItems.length > 0
    ? galleryItems[nextIndex % galleryItems.length]
    : null

  const currentBlurDataUrl = useMemo(() => {
    if (!currentItem || !currentItem.blurhash) {
      return null
    }
    return buildBlurDataUrl(currentItem.blurhash)
  }, [currentItem])

  const nextBlurDataUrl = useMemo(() => {
    if (!nextItem || !nextItem.blurhash) {
      return null
    }
    return buildBlurDataUrl(nextItem.blurhash)
  }, [nextItem])

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

  const markImageLoaded = (url: string) => {
    setLoadedImageUrls((previous) => {
      if (previous[url]) {
        return previous
      }
      return { ...previous, [url]: true }
    })
  }

  useEffect(() => {
    if (galleryItems.length < 2) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => {
        const safeIndex = index % galleryItems.length
        const upcomingIndex = getRandomIndex(galleryItems.length, safeIndex)
        setNextIndex(upcomingIndex)
        setIsTransitioning(true)

        if (transitionTimeoutRef.current !== null) {
          window.clearTimeout(transitionTimeoutRef.current)
        }

        transitionTimeoutRef.current = window.setTimeout(() => {
          setCurrentIndex(upcomingIndex)
          setIsTransitioning(false)
          setNextIndex(null)
        }, 1000)

        return safeIndex
      })
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
        transitionTimeoutRef.current = null
      }
    }
  }, [galleryItems])

  useEffect(() => {
    if (!isRandomLoading || !randomLoaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: randomLoaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: theme === 'dark' ? LOADER_ANIMATION_YELLOW_PATH : LOADER_ANIMATION_DEFAULT_PATH,
    })

    return () => {
      animation.destroy()
    }
  }, [isRandomLoading, theme])

  const newsError = isNewsError ? getRtkErrorMessage(newsQueryError, 'Не удалось загрузить новости.') : ''

  return (
    <section className={styles.page}>
      <h1>Добро пожаловать на лыжную базу города Тында!</h1>
      <div className={`${styles.hero} ${styles.contentWidth}`}>
        <img className={styles.heroImageTop} src="/preview.jpg" alt="Снег и трассы" />
        {isRandomLoading ? (
          <div className={styles.heroLoader} role="status" aria-live="polite">
            <div className={styles.heroLoaderAnimation} ref={randomLoaderRef} />
            <LoaderFallbackDots />
          </div>
        ) : galleryItems.length > 0 ? (
          <Link className={styles.heroLink} to="/gallery">
            <div className={styles.heroImageBottomFrame}>
              <div
                key={`current-${currentIndex}`}
                className={`${styles.heroImageLayer} ${
                  isTransitioning ? styles.heroImageLeaving : ''
                }`}
              >
                {currentBlurDataUrl ? (
                  <img
                    className={`${styles.heroBlur} ${
                      currentItem?.url && loadedImageUrls[currentItem.url] ? styles.heroBlurHidden : ''
                    }`}
                    src={currentBlurDataUrl}
                    alt=""
                    aria-hidden="true"
                  />
                ) : null}
                <img
                  className={styles.heroImageBottom}
                  src={currentItem?.url}
                  alt={currentItem?.alt ?? 'Фотография из галереи'}
                  onLoad={() => {
                    if (currentItem?.url) {
                      markImageLoaded(currentItem.url)
                    }
                  }}
                />
              </div>
              {isTransitioning && nextItem ? (
                <div key={`next-${nextIndex}`} className={`${styles.heroImageLayer} ${styles.heroImageEntering}`}>
                  {nextBlurDataUrl ? (
                    <img
                      className={`${styles.heroBlur} ${
                        loadedImageUrls[nextItem.url] ? styles.heroBlurHidden : ''
                      }`}
                      src={nextBlurDataUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : null}
                  <img
                    className={styles.heroImageBottom}
                    src={nextItem.url}
                    alt={nextItem.alt ?? 'Фотография из галереи'}
                    onLoad={() => {
                      markImageLoaded(nextItem.url)
                    }}
                  />
                </div>
              ) : null}
            </div>
          </Link>
        ) : null}
      </div>
      {isNewsLoading ? (
        <p className={styles.latestStatus}>{'Загрузка...'}</p>
      ) : newsError ? (
        <p className={styles.latestStatus}>{newsError}</p>
      ) : latestNews ? (
        <>
          <h2 className={styles.announcementTitle}>{'Объявление'}</h2>
          <NewsCard item={latestNews} dateLabel={latestDate} text={getPreviewText(latestNews.text)} />
        </>
      ) : (
        <p className={styles.latestStatus}>{'Пока нет новостей.'}</p>
      )}
      <TrainingScheduleSection title="График тренировки детей" titleLinkTo="/training" compact />
      <ScheduleSection title="График работы проката лыж" titleLinkTo="/rental" apiPath="/schedule" compact />
      <div>
        <h2 className={styles.mapTitle}>Как добраться</h2>
        <p className={styles.mapText}>На автобусе №3 до остановки "улица Автомобилистов"</p>
      </div>
      <iframe className={styles.mapFrame} src={mapWidgetSrc} allowFullScreen title="Лыжная база на карте" />
    </section>
  )
}
