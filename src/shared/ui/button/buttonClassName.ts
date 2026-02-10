import type { ButtonStyleProps } from './Button.types'
import styles from './Button.module.scss'

const joinClassNames = (items: Array<string | false | undefined>) =>
  items.filter(Boolean).join(' ')

export const getButtonClassName = ({
  variant = 'outline',
  size = 'default',
  uppercase = false,
  className,
}: ButtonStyleProps = {}) =>
  joinClassNames([
    styles.button,
    styles[`variant${variant[0].toUpperCase()}${variant.slice(1)}`],
    styles[`size${size[0].toUpperCase()}${size.slice(1)}`],
    uppercase && styles.uppercase,
    className,
  ])
