import { useMemo } from 'react'
import { TESLENKO_PROFILE_PARAGRAPHS } from '../../aboutAccordion/model/teslenkoProfile'
import { GRADUATES_DATA, Graduates } from '../../graduates'
import type { Graduate } from '../../graduates'
import styles from './HomeHighlights.module.scss'

type HomeHighlightsProps = {
  cardsCount?: number
}

const TESLENKO_CARD: Graduate = {
  id: 'vladimir-teslenko',
  fullName: 'Владимир Власович Тесленко',
  cardPhoto: {
    src: '/about/teslenko-vladimir-vlasovich.jpg',
    alt: 'Владимир Власович Тесленко.',
  },
  shortDescription:
    'Тренер-преподаватель по лыжным гонкам и один из ключевых наставников лыжного спорта в Тынде.',
  fullDescription: TESLENKO_PROFILE_PARAGRAPHS,
  gallery: [
    {
      src: '/about/teslenko-vladimir-vlasovich.jpg',
      alt: 'Владимир Власович Тесленко.',
    },
  ],
}

const shuffle = <T,>(items: T[]) => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const temp = result[index]
    result[index] = result[randomIndex]
    result[randomIndex] = temp
  }
  return result
}

const buildAboutDetailsHref = (graduate: Graduate) => {
  const section = graduate.id === 'vladimir-teslenko' ? 'teslenko' : 'graduates'
  return `/about?section=${section}&person=${graduate.id}`
}

export const HomeHighlights = ({ cardsCount = 1 }: HomeHighlightsProps) => {
  const cards = useMemo(() => {
    const pool = [TESLENKO_CARD, ...GRADUATES_DATA]
    const safeCount = Math.max(1, Math.min(cardsCount, pool.length))
    return shuffle(pool).slice(0, safeCount)
  }, [cardsCount])

  return (
    <section className={styles.section} aria-labelledby="home-highlights-title">
      <div className={styles.titleFrame}>
        <h2 className={styles.title} id="home-highlights-title">
          Лучшие представители тындинской школы лыжников-гонщиков
        </h2>
      </div>
      <div className={styles.cardsFrame}>
        <Graduates
          graduates={cards}
          getDetailsHref={buildAboutDetailsHref}
          photoLoading="eager"
          constrainedHeight
        />
      </div>
    </section>
  )
}
