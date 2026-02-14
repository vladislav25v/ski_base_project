import styles from './Rental.module.scss'
import { ScheduleSection } from '../../shared/features/schedule'

export const RentalPage = () => (
  <section className={styles.page}>
    <div className={styles.info}>
      <h1 className={styles.title}>{'Прокат лыж'}</h1>
      <p className={styles.text}>{'Взрослый — 230 рублей, детский — 170 рублей.'}</p>
      <p className={styles.text}>
        {'В наличии есть инвентарь на большинство размеров. Оплата наличными.'}
      </p>
    </div>
    <ScheduleSection title="График работы проката лыж" />
  </section>
)
