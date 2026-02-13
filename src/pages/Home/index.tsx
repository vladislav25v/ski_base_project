import styles from './Home.module.scss'

export const HomePage = () => {
  return (
    <section className={styles.page}>
      <h1>Добро пожаловать на лыжную базу города Тында!</h1>
      <div className={`${styles.hero} ${styles.contentWidth}`}>
        <img className={styles.heroImage} src="/preview.jpg" alt="Снег и трассы" />
      </div>
      <h2 className={styles.mapTitle} id="how-to-get">
        Как добраться
      </h2>
      <iframe
        className={styles.mapFrame}
        src="https://yandex.ru/map-widget/v1/?ll=124.703548%2C55.161825&mode=poi&poi%5Bpoint%5D=124.701973%2C55.160831&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D186711668181&z=14"
        allowFullScreen
        title="Лыжная база на карте"
      />
    </section>
  )
}
