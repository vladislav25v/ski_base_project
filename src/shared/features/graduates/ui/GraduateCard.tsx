import { useState } from 'react'
import type { Graduate } from '../model/types'
import styles from './Graduates.module.scss'

type GraduateCardProps = {
  graduate: Graduate
}

export const GraduateCard = ({ graduate }: GraduateCardProps) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className={styles.card}>
      <img
        className={styles.cardPhoto}
        src={graduate.cardPhoto.src}
        alt={graduate.cardPhoto.alt}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.cardBody}>
        <header className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{graduate.fullName}</h3>
          {graduate.graduationYear ? (
            <p className={styles.cardMeta}>Выпуск: {graduate.graduationYear}</p>
          ) : null}
        </header>
        <p className={styles.cardShort}>{graduate.shortDescription}</p>

        <button
          type="button"
          className={styles.cardToggle}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? 'Свернуть' : 'Подробнее'}
        </button>

        {expanded ? (
          <div className={styles.cardDetails}>
            {graduate.fullDescription.map((paragraph, index) => (
              <p key={`${graduate.id}-full-${index}`} className={styles.cardParagraph}>
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
