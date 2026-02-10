import type { ButtonHTMLAttributes } from 'react'
import styles from './Toggle.module.scss'

type ToggleProps = {
  checked: boolean
  labelLeft?: string
  labelRight?: string
  className?: string
  onChange: (checked: boolean) => void
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'>

const joinClassNames = (items: Array<string | false | undefined>) =>
  items.filter(Boolean).join(' ')

export const Toggle = ({
  checked,
  labelLeft = 'Light',
  labelRight = 'Dark',
  className,
  onChange,
  ...props
}: ToggleProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={joinClassNames([styles.toggle, checked && styles.checked, className])}
      onClick={() => onChange(!checked)}
      {...props}
    >
      <span className={joinClassNames([styles.label, !checked && styles.labelActive])}>
        {labelLeft}
      </span>
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
      <span className={joinClassNames([styles.label, checked && styles.labelActive])}>
        {labelRight}
      </span>
    </button>
  )
}
