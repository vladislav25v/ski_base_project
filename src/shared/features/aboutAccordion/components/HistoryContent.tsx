import { HISTORY_BLOCKS } from '../model/historyBlocks'
import styles from '../AboutAccordion.module.scss'

export const HistoryContent = () => (
  <div className={styles.history}>
    {HISTORY_BLOCKS.map((block, blockIndex) =>
      block.type === 'paragraph' ? (
        <p key={`history-paragraph-${blockIndex}`} className={styles.historyParagraph}>
          {block.text}
        </p>
      ) : (
        <figure key={`history-image-${blockIndex}`} className={styles.historyFigure}>
          <img
            className={styles.historyImage}
            src={block.src}
            alt={block.alt}
            loading="lazy"
            decoding="async"
          />
          <figcaption className={styles.historyCaption}>{block.caption}</figcaption>
        </figure>
      ),
    )}
  </div>
)
