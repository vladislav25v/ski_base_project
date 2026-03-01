import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../ui'
import type { NewsItem } from '../../model'
import styles from './NewsCard.module.scss'

type NewsCardProps = {
  item: NewsItem
  dateLabel?: string
  text?: string
  clickable?: boolean
  linkTo?: string
  rootId?: string
  isAdmin?: boolean
  isEditing?: boolean
  onEdit?: () => void
}

export const NewsCard = ({
  item,
  dateLabel,
  text,
  clickable = true,
  linkTo,
  rootId,
  isAdmin = false,
  isEditing = false,
  onEdit,
}: NewsCardProps) => {
  const showEdit = isAdmin && typeof onEdit === 'function'
  const showHeader = Boolean(dateLabel) || showEdit
  const handleEditClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onEdit?.()
  }

  const cardContent = (
    <>
      {showHeader && (
        <div className={styles.cardHeader}>
          {dateLabel && <span className={styles.date}>{dateLabel}</span>}
          {showEdit && (
            <Button size="compact" onClick={handleEditClick} disabled={isEditing}>
              {'Редактировать'}
            </Button>
          )}
        </div>
      )}
      {item.imageUrl && (
        <img className={styles.image} src={item.imageUrl} alt={'Новость'} loading="lazy" />
      )}
      <h2 className={styles.cardTitle}>{item.title}</h2>
      <p className={styles.text}>{text ?? item.text}</p>
    </>
  )

  if (!clickable) {
    return (
      <article id={rootId} className={styles.card}>
        {cardContent}
      </article>
    )
  }

  const target = linkTo ?? `/news#news-${item.id}`

  return (
    <Link id={rootId} className={styles.card} to={target}>
      {cardContent}
    </Link>
  )
}
