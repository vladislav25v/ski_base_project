import { TESLENKO_PROFILE_PARAGRAPHS } from '../model/teslenkoProfile'
import styles from '../AboutAccordion.module.scss'

export const TeslenkoContent = () => (
  <div id="vladimir-teslenko" className={styles.history}>
    <figure className={styles.historyFigure}>
      <img
        className={styles.historyImage}
        src="/about/teslenko-vladimir-vlasovich.jpg"
        alt="Тесленко Владимир Власович"
        loading="lazy"
        decoding="async"
      />
      <figcaption className={styles.historyCaption}>Тесленко Владимир Власович</figcaption>
    </figure>
    {TESLENKO_PROFILE_PARAGRAPHS.map((paragraph, index) => (
      <p key={`teslenko-paragraph-${index}`} className={styles.historyParagraph}>
        {paragraph}
      </p>
    ))}
  </div>
)
