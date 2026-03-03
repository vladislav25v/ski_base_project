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
  linkState?: unknown
  rootId?: string
  onOpen?: () => void
  onShare?: () => void
  shareLabel?: string
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
  linkState,
  rootId,
  onOpen,
  onShare,
  shareLabel = 'Поделиться',
  isAdmin = false,
  isEditing = false,
  onEdit,
}: NewsCardProps) => {
  const showEdit = isAdmin && typeof onEdit === 'function'
  const showShare = typeof onShare === 'function'
  const showHeader = Boolean(dateLabel) || showEdit || showShare

  const handleEditClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onEdit?.()
  }

  const handleShareClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onShare?.()
  }

  const cardContent = (
    <>
      {showHeader && (
        <div className={styles.cardHeader}>
          {dateLabel && <span className={styles.date}>{dateLabel}</span>}
          {(showShare || showEdit) && (
            <div className={styles.actions}>
              {showShare && (
                <Button size="compact" variant="outline" onClick={handleShareClick}>
                  {shareLabel}
                </Button>
              )}
              {showEdit && (
                <Button size="compact" onClick={handleEditClick} disabled={isEditing}>
                  {'Редактировать'}
                </Button>
              )}
            </div>
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
      <article
        id={rootId}
        className={styles.card}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (!onOpen) {
            return
          }
          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }
          event.preventDefault()
          onOpen()
        }}
      >
        {cardContent}
      </article>
    )
  }

  const target = linkTo ?? '/news'

  return (
    <Link id={rootId} className={styles.card} to={target} state={linkState}>
      {cardContent}
    </Link>
  )
}
