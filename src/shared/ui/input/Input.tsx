import { forwardRef, type InputHTMLAttributes } from 'react'
import styles from './Input.module.scss'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return <input ref={ref} className={[styles.input, className].filter(Boolean).join(' ')} {...props} />
})

Input.displayName = 'Input'
