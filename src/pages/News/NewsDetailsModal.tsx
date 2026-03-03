import { useEffect } from 'react'
import { useLocation, useNavigate, useParams, type Location } from 'react-router-dom'
import { useGetNewsByIdQuery } from '../../app/store/apiSlice'
import { FormModal } from '../../shared/ui'
import { getRtkErrorMessage } from '../../shared/lib/rtkQuery'
import { applyNewsSeo } from '../../shared/lib'
import { NewsDetailsContent } from './NewsDetailsContent'
import { parseNewsId } from './newsId'
import styles from './NewsDetails.module.scss'

type BackgroundLocationState = {
  backgroundLocation?: Location
}

export const NewsDetailsModal = () => {
  const { id: idParam } = useParams()
  const newsId = parseNewsId(idParam)
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as BackgroundLocationState | null
  const hasBackgroundLocation = Boolean(state?.backgroundLocation)
  const { data, isLoading, isError, error } = useGetNewsByIdQuery(newsId ?? 0, {
    skip: newsId === null,
  })

  useEffect(() => {
    if (!data) {
      return
    }
    applyNewsSeo(data)
  }, [data])

  const closeModal = () => {
    if (hasBackgroundLocation) {
      navigate(-1)
      return
    }
    navigate('/news', { replace: true })
  }

  const errorMessage = newsId === null
    ? 'Некорректный идентификатор новости.'
    : isError
      ? getRtkErrorMessage(error, 'Не удалось загрузить новость.')
      : ''

  return (
    <FormModal
      title={data?.title ?? 'Новость'}
      isVisible
      isClosing={false}
      onRequestClose={closeModal}
    >
      <div className={styles.modalBody}>
        {isLoading && <p className={styles.status}>{'Загрузка новости...'}</p>}
        {errorMessage && <p className={`${styles.status} ${styles.error}`}>{errorMessage}</p>}
        {data ? <NewsDetailsContent item={data} /> : null}
      </div>
    </FormModal>
  )
}
