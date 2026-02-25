import { GRADUATES_DATA } from '../model/graduatesData'
import type { Graduate } from '../model/types'
import { GraduateCard } from './GraduateCard'
import styles from './Graduates.module.scss'

type GraduatesProps = {
  graduates?: Graduate[]
  getDetailsHref?: (graduate: Graduate) => string | undefined
  photoLoading?: 'lazy' | 'eager'
  constrainedHeight?: boolean
}

export const Graduates = ({
  graduates = GRADUATES_DATA,
  getDetailsHref,
  photoLoading = 'lazy',
  constrainedHeight = false,
}: GraduatesProps) => (
  <div className={styles.list}>
    {graduates.map((graduate) => (
      <GraduateCard
        key={graduate.id}
        graduate={graduate}
        detailsHref={getDetailsHref?.(graduate)}
        photoLoading={photoLoading}
        constrainedHeight={constrainedHeight}
      />
    ))}
  </div>
)
