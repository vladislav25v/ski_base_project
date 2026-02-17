import styles from './Training.module.scss'
import { ScheduleSection } from '../../shared/features/schedule'

export const TrainingPage = () => (
  <section className={styles.page}>
    <ScheduleSection
      title="График тренировки детей"
      apiPath="/training-schedule"
      compact
    />
  </section>
)
