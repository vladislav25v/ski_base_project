import styles from './LoaderFallbackDots.module.scss'

type LoaderFallbackDotsProps = {
  className?: string
}

const joinClassNames = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ')

export const LoaderFallbackDots = ({ className }: LoaderFallbackDotsProps) => {
  return (
    <span className={joinClassNames(styles.loaderDots, className)} aria-hidden="true">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  )
}
