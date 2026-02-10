import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'outline' | 'solid' | 'danger' | 'text'
export type ButtonSize = 'default' | 'compact' | 'square'

export type ButtonStyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  uppercase?: boolean
  className?: string
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps
