import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { buildBlurDataUrl } from '../utils'
import styles from './GalleryViewerModal.module.scss'

export type GalleryViewerItem = {
  src: string
  alt: string
  caption?: string | null
  blurhash?: string | null
  width?: number | null
  height?: number | null
}

type GalleryViewerModalProps = {
  isVisible: boolean
  isClosing: boolean
  isBusy?: boolean
  items: GalleryViewerItem[]
  activeIndex: number | null
  errorMessage?: string
  actions?: ReactNode
  onRequestClose: () => void
  onPrev: () => void
  onNext: () => void
}

const joinClassNames = (...classes: Array<string | false>) => classes.filter(Boolean).join(' ')

export const GalleryViewerModal = ({
  isVisible,
  isClosing,
  isBusy = false,
  items,
  activeIndex,
  errorMessage = '',
  actions = null,
  onRequestClose,
  onPrev,
  onNext,
}: GalleryViewerModalProps) => {
  const activeItem = activeIndex !== null ? items[activeIndex] : null
  const [loadedImageSrc, setLoadedImageSrc] = useState('')
  const blurDataUrl = activeItem?.blurhash ? buildBlurDataUrl(activeItem.blurhash) : null
  const isImageLoaded = Boolean(activeItem?.src) && loadedImageSrc === (activeItem?.src ?? '')

  useEffect(() => {
    if (!isVisible || !activeItem) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onRequestClose()
      } else if (event.key === 'ArrowRight' && items.length > 1) {
        onNext()
      } else if (event.key === 'ArrowLeft' && items.length > 1) {
        onPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeItem, isVisible, items.length, onNext, onPrev, onRequestClose])

  if (!isVisible || !activeItem) {
    return null
  }

  const currentItem = activeItem

  const imageWrapperStyle: CSSProperties = {
    aspectRatio:
      currentItem.width && currentItem.height ? `${currentItem.width} / ${currentItem.height}` : undefined,
  }
  const isNavigationDisabled = isBusy || items.length <= 1

  return (
    <div
      className={joinClassNames(
        styles.viewerOverlay,
        isClosing ? styles.viewerOverlayClosing : styles.viewerOverlayOpen,
      )}
      onMouseDown={onRequestClose}
    >
      <div
        className={joinClassNames(styles.viewer, isClosing ? styles.viewerClosing : styles.viewerOpen)}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.viewerHeader}>
          <span className={styles.viewerCount}>
            {activeIndex !== null ? `${activeIndex + 1} / ${items.length}` : ''}
          </span>
          <button
            type="button"
            className={styles.viewerClose}
            onClick={onRequestClose}
            disabled={isBusy}
            aria-label="Закрыть"
          >
            {'X'}
          </button>
        </div>
        <div className={styles.viewerBody}>
          <div className={styles.viewerImageShell}>
            <div className={styles.viewerImageWrapper} style={imageWrapperStyle}>
              {blurDataUrl ? (
                <img
                  className={joinClassNames(styles.viewerBlur, isImageLoaded && styles.viewerBlurHidden)}
                  src={blurDataUrl}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
              <img
                className={joinClassNames(styles.viewerImage, isImageLoaded && styles.viewerImageVisible)}
                src={currentItem.src}
                alt={currentItem.alt}
                loading="eager"
                decoding="async"
                onLoad={() => setLoadedImageSrc(currentItem.src)}
              />
            </div>
            <button
              type="button"
              className={styles.viewerArrowLeft}
              onClick={onPrev}
              disabled={isNavigationDisabled}
              aria-label="Предыдущее фото"
            >
              {'<'}
            </button>
            <button
              type="button"
              className={styles.viewerArrowRight}
              onClick={onNext}
              disabled={isNavigationDisabled}
              aria-label="Следующее фото"
            >
              {'>'}
            </button>
          </div>
          {currentItem.caption ? <p className={styles.viewerCaption}>{currentItem.caption}</p> : null}
        </div>
        {errorMessage ? <p className={styles.viewerError}>{errorMessage}</p> : null}
        {actions ? <div className={styles.viewerActions}>{actions}</div> : null}
      </div>
    </div>
  )
}
