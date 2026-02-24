import styles from './LoaderFallbackDots.module.scss'

type LoaderFallbackDotsProps = {
  className?: string
}

export const LoaderFallbackDots = ({ className }: LoaderFallbackDotsProps) => (
  <span className={`${styles.loader}${className ? ` ${className}` : ''}`} aria-hidden="true">
    <span className={styles.dot} />
    <span className={styles.dot} />
    <span className={styles.dot} />
  </span>
)
