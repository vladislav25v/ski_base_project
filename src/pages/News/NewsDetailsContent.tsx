import type { NewsItem } from '../../shared/model'
import { formatNewsDate } from './newsDate'
import styles from './NewsDetails.module.scss'

type NewsDetailsContentProps = {
  item: NewsItem
}

export const NewsDetailsContent = ({ item }: NewsDetailsContentProps) => {
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>{item.title}</h1>
      <time className={styles.date} dateTime={item.createdAt}>
        {formatNewsDate(item.createdAt)}
      </time>
      {item.imageUrl ? (
        <img className={styles.image} src={item.imageUrl} alt={`Фото к новости: ${item.title}`} />
      ) : null}
      <p className={styles.text}>{item.text}</p>
    </article>
  )
}
