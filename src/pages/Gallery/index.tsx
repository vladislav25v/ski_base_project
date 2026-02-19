import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import lottie from 'lottie-web'
import Masonry from 'react-masonry-css'
import {
  type GalleryItem,
  type GalleryUploadMeta,
  useDeleteGalleryPictureMutation,
  useGetGalleryQuery,
  useUploadGalleryMutation,
} from '../../app/store/apiSlice'
import { useAppSelector } from '../../app/store/hooks'
import { selectIsAdmin } from '../../app/store/slices/authSlice'
import { selectTheme } from '../../app/store/slices/uiSlice'
import { getRtkErrorMessage } from '../../shared/lib/rtkQuery'
import { Button, FormModal, LoaderFallbackDots, useModalClosing } from '../../shared/ui'
import {
  buildBlurDataUrl,
  getImageMetadata,
  getImageValidationError,
  shuffleItems,
} from '../../shared/features/gallery/utils'
import styles from './Gallery.module.scss'
import formStyles from '../../shared/ui/forms/commonForm/CommonForm.module.scss'

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'

type GalleryImageProps = {
  src: string
  alt: string
  blurhash?: string | null
  loading?: 'lazy' | 'eager'
  wrapperClassName?: string
  imageClassName?: string
  wrapperStyle?: CSSProperties
}

const masonryBreakpoints = {
  default: 3,
  1100: 2,
  760: 1,
}

const joinClassNames = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(' ')

const sortByNewest = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

const GalleryImage = ({
  src,
  alt,
  blurhash,
  loading = 'lazy',
  wrapperClassName,
  imageClassName,
  wrapperStyle,
}: GalleryImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const blurDataUrl = useMemo(() => {
    if (!blurhash) {
      return null
    }
    return buildBlurDataUrl(blurhash)
  }, [blurhash])

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {blurDataUrl && (
        <img
          className={joinClassNames(styles.blur, isLoaded && styles.blurHidden)}
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
        />
      )}
      <img
        className={joinClassNames(styles.image, isLoaded && styles.imageVisible, imageClassName)}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  )
}

export const GalleryPage = () => {
  const [items, setItems] = useState<GalleryItem[]>([])
  const isAdmin = useAppSelector(selectIsAdmin)
  const theme = useAppSelector(selectTheme)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadInputKey, setUploadInputKey] = useState(0)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [viewerError, setViewerError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const modalLoaderRef = useRef<HTMLDivElement | null>(null)
  const successCloseTimeoutRef = useRef<number | null>(null)
  const closeDelayMs = 220
  const isUploadBusy = isUploading || isSaving
  const isViewerOpen = viewerIndex !== null
  const activeItem = viewerIndex !== null ? items[viewerIndex] : null

  const {
    data: galleryData = [],
    isLoading,
    isError,
    error: galleryError,
  } = useGetGalleryQuery()
  const [uploadGallery] = useUploadGalleryMutation()
  const [deleteGalleryPicture] = useDeleteGalleryPictureMutation()

  useEffect(() => {
    setItems(shuffleItems(galleryData))
  }, [galleryData])

  const orderedItems = useMemo(() => items, [items])
  const loadError = isError ? getRtkErrorMessage(galleryError, 'Ошибка загрузки галереи.') : ''

  useEffect(() => {
    if (!isLoading || !loaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: loaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: theme === 'dark' ? LOADER_ANIMATION_YELLOW_PATH : LOADER_ANIMATION_DEFAULT_PATH,
    })

    return () => {
      animation.destroy()
    }
  }, [isLoading, theme])

  useEffect(() => {
    if (!isUploadBusy || !modalLoaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: modalLoaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: theme === 'dark' ? LOADER_ANIMATION_YELLOW_PATH : LOADER_ANIMATION_DEFAULT_PATH,
    })

    return () => {
      animation.destroy()
    }
  }, [isUploadBusy, theme])

  useEffect(() => {
    return () => {
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
        successCloseTimeoutRef.current = null
      }
    }
  }, [])

  const closeUploadModal = () => {
    setIsUploadOpen(false)
    setUploadFiles([])
    setUploadCaption('')
    setFormError('')
    setSuccessMessage('')
    setUploadInputKey((current) => current + 1)
  }

  const closeViewerModal = () => {
    setViewerIndex(null)
    setViewerError('')
  }

  const {
    isVisible: isUploadVisible,
    isClosing: isUploadClosing,
    requestClose: requestCloseUpload,
  } = useModalClosing({
    isOpen: isUploadOpen,
    isBusy: isUploadBusy,
    closeDelayMs,
    onClose: closeUploadModal,
  })

  const {
    isVisible: isViewerVisible,
    isClosing: isViewerClosing,
    requestClose: requestCloseViewer,
  } = useModalClosing({
    isOpen: isViewerOpen,
    isBusy: isDeleting,
    closeDelayMs,
    onClose: closeViewerModal,
  })

  const openUploadModal = () => {
    if (successCloseTimeoutRef.current !== null) {
      window.clearTimeout(successCloseTimeoutRef.current)
      successCloseTimeoutRef.current = null
    }
    setIsUploadOpen(true)
    setUploadFiles([])
    setUploadCaption('')
    setFormError('')
    setSuccessMessage('')
    setUploadInputKey((current) => current + 1)
  }

  const openViewer = (index: number) => {
    setViewerIndex(index)
    setViewerError('')
  }

  const goNext = useCallback(() => {
    if (items.length === 0) {
      return
    }
    setViewerIndex((current) => {
      if (current === null) {
        return 0
      }
      return (current + 1) % items.length
    })
  }, [items.length])

  const goPrev = useCallback(() => {
    if (items.length === 0) {
      return
    }
    setViewerIndex((current) => {
      if (current === null) {
        return 0
      }
      return (current - 1 + items.length) % items.length
    })
  }, [items.length])

  useEffect(() => {
    if (!isViewerOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestCloseViewer()
      }
      if (event.key === 'ArrowRight') {
        goNext()
      }
      if (event.key === 'ArrowLeft') {
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isViewerOpen, requestCloseViewer, goNext, goPrev])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const invalidFile = files.find((file) => getImageValidationError(file))
    if (invalidFile) {
      const validationError = getImageValidationError(invalidFile)
      setFormError(validationError || 'Некорректный файл.')
      event.target.value = ''
      return
    }

    setUploadFiles(files)
    setFormError('')
    setSuccessMessage('')
  }

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      setFormError('Выберите изображения.')
      return
    }

    const invalidFile = uploadFiles.find((file) => getImageValidationError(file))
    if (invalidFile) {
      const validationError = getImageValidationError(invalidFile)
      setFormError(validationError || 'Некорректный файл.')
      return
    }

    setIsUploading(true)
    setIsSaving(true)
    setFormError('')
    setSuccessMessage('')

    try {
      const meta: GalleryUploadMeta[] = await Promise.all(
        uploadFiles.map(async (file) => {
          const { width, height, blurhash } = await getImageMetadata(file)
          return {
            width,
            height,
            blurhash,
            caption: uploadCaption.trim() ? uploadCaption.trim() : null,
          }
        }),
      )
      const createdItems = await uploadGallery({ files: uploadFiles, meta }).unwrap()

      if (createdItems.length > 0) {
        setItems((current) => shuffleItems([...createdItems, ...current]))
      }

      setSuccessMessage('Успешно')
      setUploadFiles([])
      setUploadCaption('')
      setIsUploading(false)
      setIsSaving(false)
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
      }
      successCloseTimeoutRef.current = window.setTimeout(() => {
        requestCloseUpload()
      }, 1000)
    } catch (uploadError) {
      setFormError(getRtkErrorMessage(uploadError, 'Ошибка загрузки.'))
      setIsUploading(false)
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeItem) {
      return
    }
    setIsDeleting(true)
    setViewerError('')

    try {
      await deleteGalleryPicture(activeItem.id).unwrap()
      setItems((current) => current.filter((item) => item.id !== activeItem.id))
      setIsDeleting(false)
      setViewerIndex((current) => {
        if (current === null) {
          return null
        }
        const nextIndex = Math.min(current, items.length - 2)
        return nextIndex >= 0 ? nextIndex : null
      })
    } catch (deleteError) {
      setViewerError(getRtkErrorMessage(deleteError, 'Ошибка удаления.'))
      setIsDeleting(false)
    }
  }

  const handleSortByDate = () => {
    setItems((current) => sortByNewest(current))
    setViewerIndex(null)
    setViewerError('')
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={handleSortByDate}>
            {'Сортировка'}
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={openUploadModal}>
              {'Добавить фото'}
            </Button>
          )}
        </div>
      </header>

      {loadError && <p className={styles.pageError}>{loadError}</p>}

      {isLoading ? (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>
            {'Загрузка...'}
            {' '}
            <LoaderFallbackDots />
          </p>
        </div>
      ) : orderedItems.length === 0 ? (
        <p className={styles.empty}>{'Пока нет фотографий.'}</p>
      ) : (
        <Masonry
          breakpointCols={masonryBreakpoints}
          className={styles.masonryGrid}
          columnClassName={styles.masonryColumn}
        >
          {orderedItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={styles.card}
              style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
              onClick={() => openViewer(index)}
            >
              <GalleryImage
                src={item.publicUrl}
                alt={item.caption || 'Фотография'}
                blurhash={item.blurhash}
                wrapperClassName={styles.imageWrapper}
                wrapperStyle={{
                  aspectRatio:
                    item.width && item.height ? `${item.width} / ${item.height}` : undefined,
                }}
              />
              {item.caption && <span className={styles.caption}>{item.caption}</span>}
            </button>
          ))}
        </Masonry>
      )}

      {isUploadVisible && (
        <FormModal
          title="Добавить фото"
          isVisible={isUploadVisible}
          isClosing={isUploadClosing}
          isBusy={isUploadBusy}
          onRequestClose={requestCloseUpload}
        >
          {isUploadBusy && (
            <div className={styles.modalLoader} role="status" aria-live="polite">
              <div className={styles.modalLoaderAnimation} ref={modalLoaderRef} />
              <span>
                {'Загрузка...'}
                {' '}
                <LoaderFallbackDots />
              </span>
            </div>
          )}
          {successMessage && <p className={formStyles.success}>{successMessage}</p>}
          <div className={formStyles.form}>
            <label className={formStyles.field}>
              <span className={formStyles.label}>{'Изображение'}</span>
              <input
                className={formStyles.input}
                type="file"
                key={uploadInputKey}
                accept="image/*"
                onChange={handleFileChange}
                multiple
                disabled={isUploadBusy}
              />
              <span className={styles.uploadHint}>{'Максимум 10 МБ, только изображения.'}</span>
              {uploadFiles.length > 0 && (
                <span className={styles.fileName}>
                  {uploadFiles.length === 1
                    ? uploadFiles[0].name
                    : `Выбрано файлов: ${uploadFiles.length}`}
                </span>
              )}
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>{'Подпись (опционально)'}</span>
              <input
                className={formStyles.input}
                type="text"
                value={uploadCaption}
                onChange={(event) => {
                  setUploadCaption(event.target.value)
                  setFormError('')
                  setSuccessMessage('')
                }}
                disabled={isUploadBusy}
              />
            </label>
            {formError && <p className={formStyles.error}>{formError}</p>}
            <div className={formStyles.actions}>
              <Button onClick={handleUpload} disabled={isUploadBusy}>
                {'Загрузить'}
              </Button>
              <Button variant="outline" onClick={requestCloseUpload} disabled={isUploadBusy}>
                {'Отмена'}
              </Button>
            </div>
          </div>
        </FormModal>
      )}

      {isViewerVisible && activeItem && (
        <div
          className={joinClassNames(
            styles.viewerOverlay,
            isViewerClosing ? styles.viewerOverlayClosing : styles.viewerOverlayOpen,
          )}
          onMouseDown={requestCloseViewer}
        >
          <div
            className={joinClassNames(
              styles.viewer,
              isViewerClosing ? styles.viewerClosing : styles.viewerOpen,
            )}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.viewerHeader}>
              <span className={styles.viewerCount}>
                {viewerIndex !== null ? `${viewerIndex + 1} / ${items.length}` : ''}
              </span>
              <button
                type="button"
                className={styles.viewerClose}
                onClick={requestCloseViewer}
                disabled={isDeleting}
                aria-label="Закрыть"
              >
                {'X'}
              </button>
            </div>
            <div className={styles.viewerBody}>
              <div className={styles.viewerImageShell}>
                <GalleryImage
                  src={activeItem.publicUrl}
                  alt={activeItem.caption || 'Фотография'}
                  blurhash={activeItem.blurhash}
                  loading="eager"
                  wrapperClassName={styles.viewerImageWrapper}
                  imageClassName={styles.viewerImage}
                  wrapperStyle={{
                    aspectRatio:
                      activeItem.width && activeItem.height
                        ? `${activeItem.width} / ${activeItem.height}`
                        : undefined,
                  }}
                />
                <button
                  type="button"
                  className={styles.viewerArrowLeft}
                  onClick={goPrev}
                  disabled={isDeleting || items.length <= 1}
                  aria-label="Предыдущее фото"
                >
                  {'<'}
                </button>
                <button
                  type="button"
                  className={styles.viewerArrowRight}
                  onClick={goNext}
                  disabled={isDeleting || items.length <= 1}
                  aria-label="Следующее фото"
                >
                  {'>'}
                </button>
              </div>
              {activeItem.caption && <p className={styles.viewerCaption}>{activeItem.caption}</p>}
            </div>
            {viewerError && <p className={styles.viewerError}>{viewerError}</p>}
            <div className={styles.viewerActions}>
              {isAdmin && (
                <Button onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Удаление...' : 'Удалить'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
