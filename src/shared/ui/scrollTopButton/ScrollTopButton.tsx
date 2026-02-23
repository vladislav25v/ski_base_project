import styles from './ScrollTopButton.module.scss'

type ScrollTopButtonProps = {
  isVisible: boolean
  onClick?: () => void
  ariaLabel?: string
}

export const ScrollTopButton = ({
  isVisible,
  onClick,
  ariaLabel = 'Прокрутить вверх',
}: ScrollTopButtonProps) => (
  <button
    type="button"
    className={`${styles.scrollTopButton} ${isVisible ? styles.scrollTopButtonVisible : ''}`}
    aria-label={ariaLabel}
    onClick={onClick ?? (() => window.scrollTo({ top: 0, behavior: 'smooth' }))}
  >
    <span className={styles.scrollTopIcon} aria-hidden="true" />
  </button>
)
