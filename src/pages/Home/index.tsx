import styles from './Home.module.scss'

export const HomePage = () => {
  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <img
          className={styles.heroImage}
          src="/PXL_20260116_044631098.jpg"
          alt="Вид лыжной базы"
          loading="lazy"
        />
      </div>
    </section>
  )
}
