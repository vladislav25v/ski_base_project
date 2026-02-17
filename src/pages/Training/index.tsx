import styles from './Training.module.scss'
import { TrainingScheduleSection } from '../../shared/features/trainingSchedule'

export const TrainingPage = () => (
  <section className={styles.page}>
    <TrainingScheduleSection title="График тренировки детей" compact />
  </section>
)
