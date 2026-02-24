import { GRADUATES_DATA } from '../model/graduatesData'
import type { Graduate } from '../model/types'
import { GraduateCard } from './GraduateCard'
import styles from './Graduates.module.scss'

type GraduatesProps = {
  graduates?: Graduate[]
}

export const Graduates = ({ graduates = GRADUATES_DATA }: GraduatesProps) => (
  <div className={styles.list}>
    {graduates.map((graduate) => (
      <GraduateCard key={graduate.id} graduate={graduate} />
    ))}
  </div>
)

