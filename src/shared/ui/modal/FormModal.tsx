import type { ReactNode } from 'react'
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
