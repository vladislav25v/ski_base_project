import type { ButtonHTMLAttributes } from 'react'
import styles from './Toggle.module.scss'

type ToggleProps = {
  checked: boolean
  labelOn?: string
  labelOff?: string
  className?: string
  onChange: (checked: boolean) => void
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'>

const joinClassNames = (items: Array<string | false | undefined>) => items.filter(Boolean).join(' ')

export const Toggle = ({
  checked,
  labelOn = 'Выключить свет',
  labelOff = 'Включить свет',
  className,
  onChange,
  ...props
}: ToggleProps) => {
  const label = checked ? labelOn : labelOff

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={joinClassNames([styles.toggle, checked && styles.checked, className])}
      onClick={() => onChange(!checked)}
      {...props}
    >
      <span className={styles.label}>
        <span className={styles.labelText}>{label}</span>
        {!checked && <span className={styles.labelCaption}>(разрешено по средам)</span>}
      </span>
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
    </button>
  )
}
