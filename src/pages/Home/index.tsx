import { useEffect, useMemo, useState } from 'react'
import styles from './Home.module.scss'
import { supabase } from '../../shared/lib'
import type { NewsItem } from '../../shared/model'
import { NewsCard } from '../../shared/features/news/NewsCard'
import { ScheduleSection } from '../../shared/features/schedule'

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
      const { data, error } = await supabase
        .from('news')
        .select('id, created_at, title, text, image_url')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!isMounted) {
        return
      }

      if (error) {
        setNewsError('Не удалось загрузить новости.')
        setIsNewsLoading(false)
        return
      }

      const item = data?.[0]
      if (item) {
        setLatestNews({
          id: item.id,
          createdAt: item.created_at,
          title: item.title,
          text: item.text,
          imageUrl: item.image_url,
        })
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

  return (
    <section className={styles.page}>
      <h1>Добро пожаловать на лыжную базу города Тында!</h1>
      <div className={`${styles.hero} ${styles.contentWidth}`}>
        <img className={styles.heroImage} src="/preview.jpg" alt="Снег и трассы" />
      </div>
      {isNewsLoading ? (
        <p className={styles.latestStatus}>{'Загрузка...'}</p>
      ) : newsError ? (
        <p className={styles.latestStatus}>{newsError}</p>
      ) : latestNews ? (
        <NewsCard item={latestNews} dateLabel={latestDate} text={getPreviewText(latestNews.text)} />
      ) : (
        <p className={styles.latestStatus}>{'Пока нет новостей.'}</p>
      )}
      <ScheduleSection />
      <h2 className={styles.mapTitle} id="how-to-get">
        Как добраться
      </h2>
      <iframe
        className={styles.mapFrame}
        src="https://yandex.ru/map-widget/v1/?ll=124.703548%2C55.161825&mode=poi&poi%5Bpoint%5D=124.701973%2C55.160831&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D186711668181&z=14"
        allowFullScreen
        title="Лыжная база на карте"
      />
    </section>
  )
}
