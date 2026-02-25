import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GalleryViewerModal } from '../../gallery/ui'
import type { Graduate } from '../model/types'
import styles from './Graduates.module.scss'
import { useModalClosing } from '../../../ui'

type GraduateCardProps = {
  graduate: Graduate
  detailsHref?: string
  photoLoading?: 'lazy' | 'eager'
  constrainedHeight?: boolean
}

const SIDE_LAYOUT_MAX_PHOTO_SHARE = 0.5
const MIN_TEXT_SHARE_FOR_SIDE_LAYOUT = 0.42
const MIN_CARD_WIDTH_FOR_SIDE_LAYOUT_REM = 30
const ROOT_FONT_SIZE_FALLBACK_PX = 16

export const GraduateCard = ({
  graduate,
  detailsHref,
  photoLoading = 'lazy',
  constrainedHeight = false,
}: GraduateCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [isSideLayout, setIsSideLayout] = useState(true)
  const cardRef = useRef<HTMLElement | null>(null)
  const cardPhotoRef = useRef<HTMLImageElement | null>(null)
  const shouldNavigateToDetails = Boolean(detailsHref)
  const isViewerOpen = viewerIndex !== null
  const viewerItems = useMemo(
    () =>
      graduate.gallery.map((photo) => ({
        src: photo.src,
        alt: photo.alt,
        caption: photo.caption,
      })),
    [graduate.gallery],
  )

  const closeViewer = useCallback(() => {
    setViewerIndex(null)
  }, [])

  const {
    isVisible: isViewerVisible,
    isClosing: isViewerClosing,
    requestClose: requestCloseViewer,
  } = useModalClosing({
    isOpen: isViewerOpen,
    onClose: closeViewer,
  })

  const goNext = useCallback(() => {
    if (graduate.gallery.length === 0) {
      return
    }
    setViewerIndex((current) => {
      if (current === null) {
        return 0
      }
      return (current + 1) % graduate.gallery.length
    })
  }, [graduate.gallery.length])

  const goPrev = useCallback(() => {
    if (graduate.gallery.length === 0) {
      return
    }
    setViewerIndex((current) => {
      if (current === null) {
        return 0
      }
      return (current - 1 + graduate.gallery.length) % graduate.gallery.length
    })
  }, [graduate.gallery.length])

  const syncLayoutByPhotoWidth = useCallback(() => {
    const cardElement = cardRef.current
    const cardPhotoElement = cardPhotoRef.current
    if (!cardElement || !cardPhotoElement) {
      return
    }

    const cardWidth = cardElement.getBoundingClientRect().width
    const cardPhotoWidth = cardPhotoElement.getBoundingClientRect().width
    if (!cardWidth || !cardPhotoWidth) {
      return
    }

    const computedStyle = window.getComputedStyle(cardElement)
    const cardGap = Number.parseFloat(computedStyle.columnGap || computedStyle.gap || '0') || 0
    const textAvailableWidth = cardWidth - cardPhotoWidth - cardGap
    const photoShare = cardPhotoWidth / cardWidth
    const textShare = textAvailableWidth / cardWidth
    const rootFontSize =
      Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) ||
      ROOT_FONT_SIZE_FALLBACK_PX
    const minCardWidth = MIN_CARD_WIDTH_FOR_SIDE_LAYOUT_REM * rootFontSize

    const shouldUseSideLayout =
      cardWidth >= minCardWidth &&
      photoShare <= SIDE_LAYOUT_MAX_PHOTO_SHARE &&
      textShare >= MIN_TEXT_SHARE_FOR_SIDE_LAYOUT

    setIsSideLayout(shouldUseSideLayout)
  }, [])

  useEffect(() => {
    const cardElement = cardRef.current
    const cardPhotoElement = cardPhotoRef.current
    if (!cardElement || !cardPhotoElement) {
      return
    }

    const scheduleLayoutSync = () => {
      window.requestAnimationFrame(syncLayoutByPhotoWidth)
    }

    scheduleLayoutSync()
    if (cardPhotoElement.complete) {
      scheduleLayoutSync()
    }

    const handleResize = () => {
      scheduleLayoutSync()
    }

    window.addEventListener('resize', handleResize)

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        scheduleLayoutSync()
      })
      resizeObserver.observe(cardElement)
      resizeObserver.observe(cardPhotoElement)

      return () => {
        window.removeEventListener('resize', handleResize)
        resizeObserver.disconnect()
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [syncLayoutByPhotoWidth])

  return (
    <article
      ref={cardRef}
      id={graduate.id}
      className={`${styles.card} ${isSideLayout ? styles.cardSide : styles.cardStack} ${
        constrainedHeight ? styles.cardConstrained : ''
      }`}
    >
      <img
        ref={cardPhotoRef}
        className={`${styles.cardPhoto} ${constrainedHeight ? styles.cardPhotoConstrained : ''}`}
        src={graduate.cardPhoto.src}
        alt={graduate.cardPhoto.alt}
        loading={photoLoading}
        decoding="async"
        onLoad={syncLayoutByPhotoWidth}
      />
      <div className={`${styles.cardBody} ${constrainedHeight ? styles.cardBodyConstrained : ''}`}>
        <header className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{graduate.fullName}</h3>
          {graduate.graduationYear ? (
            <p className={styles.cardMeta}>Выпуск: {graduate.graduationYear}</p>
          ) : null}
        </header>
        <p className={`${styles.cardShort} ${constrainedHeight ? styles.cardShortConstrained : ''}`}>
          {graduate.shortDescription}
        </p>

        {shouldNavigateToDetails ? (
          <Link className={styles.cardToggle} to={detailsHref || '/about'}>
            Подробнее
          </Link>
        ) : (
          <button
            type="button"
            className={styles.cardToggle}
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? 'Свернуть' : 'Подробнее'}
          </button>
        )}

        {!shouldNavigateToDetails && expanded ? (
          <div className={styles.cardDetails}>
            {graduate.fullDescription.map((paragraph, index) => (
              <p key={`${graduate.id}-full-${index}`} className={styles.cardParagraph}>
                {paragraph}
              </p>
            ))}
            {graduate.gallery.length ? (
              <div className={styles.gallery}>
                {graduate.gallery.map((photo, index) => (
                  <figure key={`${graduate.id}-photo-${index}`} className={styles.galleryItem}>
                    <button
                      type="button"
                      className={styles.galleryButton}
                      onClick={() => setViewerIndex(index)}
                      aria-label={`Открыть фото ${index + 1}`}
                    >
                      <img
                        className={styles.galleryImage}
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                    {photo.caption ? <figcaption className={styles.galleryCaption}>{photo.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <GalleryViewerModal
        isVisible={isViewerVisible}
        isClosing={isViewerClosing}
        items={viewerItems}
        activeIndex={viewerIndex}
        onRequestClose={requestCloseViewer}
        onPrev={goPrev}
        onNext={goNext}
      />
    </article>
  )
}
