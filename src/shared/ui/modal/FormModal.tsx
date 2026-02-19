import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './FormModal.module.scss'

type FormModalProps = {
  title: string
  isVisible: boolean
  isClosing: boolean
  isBusy?: boolean
  onRequestClose: () => void
  children: ReactNode
}

export const FormModal = ({
  title,
  isVisible,
  isClosing,
  isBusy = false,
  onRequestClose,
  children,
}: FormModalProps) => {
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isVisible || typeof document === 'undefined') {
      return
    }

    const previousActiveElement = document.activeElement as HTMLElement | null
    const appRoot = document.getElementById('root')
    appRoot?.setAttribute('inert', '')

    const getFocusableElements = () =>
      Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
          ].join(','),
        ) ?? [],
      )

    const focusableElements = getFocusableElements()
    focusableElements[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isBusy) {
          onRequestClose()
        }
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const elements = getFocusableElements()
      if (!elements.length) {
        event.preventDefault()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
        return
      }

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      appRoot?.removeAttribute('inert')
      previousActiveElement?.focus()
    }
  }, [isBusy, isVisible, onRequestClose])

  if (!isVisible) {
    return null
  }

  const handleOverlayMouseDown = () => {
    if (isBusy) {
      return
    }
    onRequestClose()
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={`${styles.modalOverlay} ${
        isClosing ? styles.modalOverlayClosing : styles.modalOverlayOpen
      }`}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className={`${styles.modal} ${isClosing ? styles.modalClosing : styles.modalOpen}`}
        onMouseDown={(event) => event.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            className={styles.modalClose}
            type="button"
            onClick={onRequestClose}
            disabled={isBusy}
            aria-label="Закрыть"
          >
            {'X'}
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
