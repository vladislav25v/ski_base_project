import { useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Link } from 'react-router-dom'
import styles from './Home.module.scss'
import { apiClient } from '../../shared/lib'
import type { NewsItem } from '../../shared/model'
import { NewsCard } from '../../shared/features/news/NewsCard'
import { ScheduleSection } from '../../shared/features/schedule'
import { TrainingScheduleSection } from '../../shared/features/trainingSchedule'
import { getGalleryPublicUrl } from '../../shared/features/gallery/api'
import { buildBlurDataUrl } from '../../shared/features/gallery/utils'
import animationData from '../../assets/loaders/animation (2).json'
import animationDataYellow from '../../assets/loaders/animation_transparent_yellow_dada00.json'

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
  const [latestNews, setLatestNews] = useState<NewsItem | null>(null)
  const [isNewsLoading, setIsNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState('')
  const [galleryItems, setGalleryItems] = useState<
    Array<{ url: string; alt: string; blurhash?: string | null }>
  >([])
  const [loadedImageUrls, setLoadedImageUrls] = useState<Record<string, true>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isRandomLoading, setIsRandomLoading] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.body.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  const randomLoaderRef = useRef<HTMLDivElement | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)

  const latestDate = useMemo(() => {
    if (!latestNews) {
      return ''
    }
    return formatDate(latestNews.createdAt)
  }, [latestNews])

  const currentItem = galleryItems[currentIndex]
  const nextItem = nextIndex !== null ? galleryItems[nextIndex] : null

  const currentBlurDataUrl = useMemo(() => {
    if (!currentItem?.blurhash) {
      return null
    }
    return buildBlurDataUrl(currentItem.blurhash)
  }, [currentItem?.blurhash])

  const nextBlurDataUrl = useMemo(() => {
    if (!nextItem?.blurhash) {
      return null
    }
    return buildBlurDataUrl(nextItem.blurhash)
  }, [nextItem?.blurhash])

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
    let isMounted = true

    const fetchLatestNews = async () => {
      setIsNewsLoading(true)
      const { data, error } = await apiClient.get<{ items: NewsItem[] }>('/news?limit=1')

      if (!isMounted) {
        return
      }

      if (error) {
        setNewsError('Не удалось загрузить новости.')
        setIsNewsLoading(false)
        return
      }

      const item = data?.items?.[0]
      if (item) {
        setLatestNews(item)
      } else {
        setLatestNews(null)
      }
      setIsNewsLoading(false)
    }

    fetchLatestNews()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchPreviewImage = async () => {
      setIsRandomLoading(true)
      const { data, error } = await apiClient.get<{
        items: Array<{ storagePath: string; caption?: string | null; blurhash?: string | null }>
      }>('/gallery')

      if (!isMounted || error || !data || data.items.length === 0) {
        if (isMounted) {
          setIsRandomLoading(false)
        }
        return
      }

      const items = data.items
        .filter((item) => Boolean(item.storagePath))
        .map((item) => ({
          url: getGalleryPublicUrl(item.storagePath) ?? '',
          alt: item.caption || 'Фотография из галереи',
          blurhash: item.blurhash ?? null,
        }))
        .filter((item) => Boolean(item.url))

      if (items.length === 0) {
        setIsRandomLoading(false)
        return
      }

      const initialIndex = Math.floor(Math.random() * items.length)
      setGalleryItems(items)
      setLoadedImageUrls({})
      setCurrentIndex(initialIndex)
      setNextIndex(null)
      setIsTransitioning(false)
      setIsRandomLoading(false)
    }

    fetchPreviewImage()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (galleryItems.length < 2) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => {
        const upcomingIndex = getRandomIndex(galleryItems.length, index)
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

        return index
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
    const observer = new MutationObserver(() => {
      setTheme(document.body.dataset.theme === 'dark' ? 'dark' : 'light')
    })

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!isRandomLoading || !randomLoaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: randomLoaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: theme === 'dark' ? animationDataYellow : animationData,
    })

    return () => {
      animation.destroy()
    }
  }, [isRandomLoading, theme])

  return (
    <section className={styles.page}>
      <h1>Добро пожаловать на лыжную базу города Тында!</h1>
      <div className={`${styles.hero} ${styles.contentWidth}`}>
        <img className={styles.heroImageTop} src="/preview.jpg" alt="Снег и трассы" />
        {isRandomLoading ? (
          <div className={styles.heroLoader} role="status" aria-live="polite">
            <div className={styles.heroLoaderAnimation} ref={randomLoaderRef} />
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
          <NewsCard
            item={latestNews}
            dateLabel={latestDate}
            text={getPreviewText(latestNews.text)}
          />
        </>
      ) : (
        <p className={styles.latestStatus}>{'Пока нет новостей.'}</p>
      )}
      <TrainingScheduleSection
        title="График тренировки детей"
        titleLinkTo="/training"
        compact
      />
      <ScheduleSection
        title="График работы проката лыж"
        titleLinkTo="/rental"
        apiPath="/schedule"
        compact
      />
      <div>
        <h2 className={styles.mapTitle}>Как добраться</h2>
        <p className={styles.mapText}>На автобусе №3 до остановки "улица Автомобилистов"</p>
      </div>
      <iframe
        className={styles.mapFrame}
        src={mapWidgetSrc}
        allowFullScreen
        title="Лыжная база на карте"
      />
    </section>
  )
}
