import { useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Link } from 'react-router-dom'
import styles from './Home.module.scss'
import { apiClient } from '../../shared/lib'
import type { NewsItem } from '../../shared/model'
import { NewsCard } from '../../shared/features/news/NewsCard'
import { ScheduleSection } from '../../shared/features/schedule'
import { getGalleryPublicUrl } from '../../shared/features/gallery/api'
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

export const HomePage = () => {
  const [latestNews, setLatestNews] = useState<NewsItem | null>(null)
  const [isNewsLoading, setIsNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState('')
  const [randomImageUrl, setRandomImageUrl] = useState<string | null>(null)
  const [randomImageAlt, setRandomImageAlt] = useState('Фотография из галереи')
  const [isRandomLoading, setIsRandomLoading] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.body.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  const randomLoaderRef = useRef<HTMLDivElement | null>(null)

  const latestDate = useMemo(() => {
    if (!latestNews) {
      return ''
    }
    return formatDate(latestNews.createdAt)
  }, [latestNews])

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
        items: Array<{ storagePath: string; caption?: string | null }>
      }>('/gallery')

      if (!isMounted || error || !data || data.items.length === 0) {
        if (isMounted) {
          setIsRandomLoading(false)
        }
        return
      }

      const randomItem = data.items[Math.floor(Math.random() * data.items.length)]
      if (!randomItem?.storagePath) {
        return
      }

      const publicUrl = getGalleryPublicUrl(randomItem.storagePath)
      if (!publicUrl) {
        setIsRandomLoading(false)
        return
      }

      setRandomImageUrl(publicUrl)
      setRandomImageAlt(randomItem.caption || 'Фотография из галереи')
      setIsRandomLoading(false)
    }

    fetchPreviewImage()

    return () => {
      isMounted = false
    }
  }, [])

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
        ) : randomImageUrl ? (
          <Link className={styles.heroLink} to="/gallery">
            <img className={styles.heroImageBottom} src={randomImageUrl} alt={randomImageAlt} />
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
      <ScheduleSection />
      <div>
        <h2 className={styles.mapTitle}>Как добраться</h2>
        <p className={styles.mapText}>На автобусе №3 до остановки "улица Автомобилистов"</p>
      </div>
      <iframe
        className={styles.mapFrame}
        src="https://yandex.ru/map-widget/v1/?ll=124.703548%2C55.161825&mode=poi&poi%5Bpoint%5D=124.701973%2C55.160831&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D186711668181&z=14"
        allowFullScreen
        title="Лыжная база на карте"
      />
    </section>
  )
}
