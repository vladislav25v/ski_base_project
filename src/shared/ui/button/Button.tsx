import type { ButtonProps } from './Button.types'
import { getButtonClassName } from './buttonClassName'

export const Button = ({
  variant,
  size,
  uppercase,
  className,
  type = 'button',
  ...props
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={getButtonClassName({ variant, size, uppercase, className })}
      {...props}
    />
  )
}
