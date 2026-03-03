import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useGetNewsByIdQuery } from '../../app/store/apiSlice'
import { applyNewsSeo } from '../../shared/lib'
import { getRtkErrorMessage } from '../../shared/lib/rtkQuery'
import { getButtonClassName } from '../../shared/ui'
import { NewsDetailsContent } from './NewsDetailsContent'
import { parseNewsId } from './newsId'
import styles from './NewsDetails.module.scss'

export const NewsDetailsPage = () => {
  const { id: idParam } = useParams()
  const newsId = parseNewsId(idParam)
  const { data, isLoading, isError, error } = useGetNewsByIdQuery(newsId ?? 0, {
    skip: newsId === null,
  })

  useEffect(() => {
    if (!data) {
      return
    }
    applyNewsSeo(data)
  }, [data])

  const errorMessage = newsId === null
    ? 'Некорректный идентификатор новости.'
    : isError
      ? getRtkErrorMessage(error, 'Не удалось загрузить новость.')
      : ''

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Link
          className={getButtonClassName({ variant: 'outline', size: 'compact', className: styles.backLink })}
          to="/news"
        >
          {'Назад к новостям'}
        </Link>
      </header>
      {isLoading && <p className={styles.status}>{'Загрузка новости...'}</p>}
      {errorMessage && <p className={`${styles.status} ${styles.error}`}>{errorMessage}</p>}
      {data ? <NewsDetailsContent item={data} /> : null}
    </section>
  )
}
