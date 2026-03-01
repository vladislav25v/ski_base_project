import { Suspense, lazy, type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import lottie from 'lottie-web'
import {
  useDeleteNewsMutation,
  useGetNewsQuery,
  useUpsertNewsMutation,
} from '../../app/store/apiSlice'
import { useAppSelector } from '../../app/store/hooks'
import { selectIsAdmin } from '../../app/store/slices/authSlice'
import { selectTheme } from '../../app/store/slices/uiSlice'
import { getRtkErrorMessage } from '../../shared/lib/rtkQuery'
import type { NewsItem } from '../../shared/model'
import { Button, LoaderFallbackDots, useModalClosing } from '../../shared/ui'
import { NewsCard } from '../../shared/features/news/NewsCard'
import styles from './News.module.scss'
const NewsAdminModal = lazy(() =>
  import('./NewsAdminModal').then((module) => ({ default: module.NewsAdminModal })),
)

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'

const sortByNewest = (items: NewsItem[]) =>
  [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

export const NewsPage = () => {
  const location = useLocation()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftText, setDraftText] = useState('')
  const [draftImageUrl, setDraftImageUrl] = useState('')
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null)
  const [isImageRemoved, setIsImageRemoved] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const isAdmin = useAppSelector(selectIsAdmin)
  const theme = useAppSelector(selectTheme)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const modalLoaderRef = useRef<HTMLDivElement | null>(null)
  const successCloseTimeoutRef = useRef<number | null>(null)

  const {
    data: newsData = [],
    isLoading,
    isError,
    error: newsError,
  } = useGetNewsQuery()
  const [upsertNews] = useUpsertNewsMutation()
  const [deleteNews] = useDeleteNewsMutation()

  const orderedNews = useMemo(() => sortByNewest(newsData), [newsData])
  const isModalOpen = isCreating || editingId !== null
  const isModalBusy = isSaving || isUploading
  const closeDelayMs = 220
  const pageError = !isCreating && editingId === null
    ? formError || (isError ? getRtkErrorMessage(newsError, 'Ошибка загрузки данных') : '')
    : ''

  const closeCreateForm = () => {
    setIsCreating(false)
    setDraftTitle('')
    setDraftText('')
    setDraftImageUrl('')
    setDraftImageFile(null)
    setIsImageRemoved(false)
    setFormError('')
    setSuccessMessage('')
    setIsDeleting(false)
  }

  const closeEditForm = () => {
    setEditingId(null)
    setDraftImageFile(null)
    setIsImageRemoved(false)
    setFormError('')
    setSuccessMessage('')
    setIsDeleting(false)
  }

  const closeModalImmediate = () => {
    if (isCreating) {
      closeCreateForm()
    } else {
      closeEditForm()
    }
  }

  const {
    isVisible: isModalVisible,
    isClosing: isModalClosing,
    requestClose: requestCloseModal,
  } = useModalClosing({
    isOpen: isModalOpen,
    isBusy: isModalBusy,
    closeDelayMs,
    onClose: closeModalImmediate,
  })

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
    if (!isModalBusy || !modalLoaderRef.current) {
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
  }, [isModalBusy, theme])

  useEffect(() => {
    return () => {
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
        successCloseTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!orderedNews.length || !location.hash) {
      return
    }

    const targetId = location.hash.slice(1)
    if (!targetId) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(targetId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [location.hash, orderedNews])

  const handleAddNews = () => {
    if (successCloseTimeoutRef.current !== null) {
      window.clearTimeout(successCloseTimeoutRef.current)
      successCloseTimeoutRef.current = null
    }
    setIsCreating(true)
    setEditingId(null)
    setDraftTitle('')
    setDraftText('')
    setDraftImageUrl('')
    setDraftImageFile(null)
    setIsImageRemoved(false)
    setFormError('')
    setSuccessMessage('')
  }

  const startEdit = (item: NewsItem) => {
    if (successCloseTimeoutRef.current !== null) {
      window.clearTimeout(successCloseTimeoutRef.current)
      successCloseTimeoutRef.current = null
    }
    setEditingId(item.id)
    setIsCreating(false)
    setDraftTitle(item.title)
    setDraftText(item.text)
    setDraftImageUrl(item.imageUrl ?? '')
    setDraftImageFile(null)
    setIsImageRemoved(false)
    setFormError('')
    setSuccessMessage('')
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setDraftImageFile(file)
    setIsImageRemoved(false)
    setFormError('')
    setSuccessMessage('')
  }

  const handleSave = async (id?: number) => {
    const trimmedTitle = draftTitle.trim()
    const trimmedText = draftText.trim()
    if (!trimmedTitle) {
      setFormError('Введите заголовок.')
      return
    }
    if (!trimmedText) {
      setFormError('Введите текст.')
      return
    }

    setIsSaving(true)
    setFormError('')
    setSuccessMessage('')

    try {
      const formData = new FormData()
      formData.append('title', trimmedTitle)
      formData.append('text', trimmedText)
      if (typeof id === 'number') {
        formData.append('id', String(id))
      }
      if (draftImageFile) {
        formData.append('image', draftImageFile)
      }
      if (isImageRemoved) {
        formData.append('remove_image', 'true')
      }

      setIsUploading(Boolean(draftImageFile))
      const payload = await upsertNews(formData).unwrap()
      setIsUploading(false)

      setSuccessMessage('Успешно')
      setDraftImageFile(null)
      setIsImageRemoved(false)
      setDraftImageUrl(payload.imageUrl ?? '')
      setIsSaving(false)
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
      }
      successCloseTimeoutRef.current = window.setTimeout(() => {
        requestCloseModal()
      }, 1000)
    } catch (saveError) {
      setFormError(getRtkErrorMessage(saveError, 'Ошибка сохранения.'))
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setIsDeleting(true)
    setIsSaving(true)

    try {
      await deleteNews(id).unwrap()
      if (editingId === id) {
        setFormError('')
      }
      setSuccessMessage('Успешно')
      setIsSaving(false)
      setIsDeleting(false)
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
      }
      successCloseTimeoutRef.current = window.setTimeout(() => {
        requestCloseModal()
      }, 1000)
    } catch (deleteError) {
      setFormError(getRtkErrorMessage(deleteError, 'Ошибка удаления.'))
      setIsSaving(false)
      setIsDeleting(false)
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{'Новости базы'}</h1>
          {isAdmin && (
            <Button variant="outline" onClick={handleAddNews}>
              {'Добавить новость'}
            </Button>
          )}
        </div>
      </header>
      {pageError && <p className={styles.pageError}>{pageError}</p>}
      {isLoading && (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>
            {'Загрузка...'}
            {' '}
            <LoaderFallbackDots />
          </p>
        </div>
      )}
      <div className={styles.list}>
        {orderedNews.map((item) => {
          const isEditing = editingId === item.id

          return (
            <NewsCard
              key={item.id}
              item={item}
              rootId={`news-${item.id}`}
              dateLabel={formatDate(item.createdAt)}
              clickable={false}
              isAdmin={isAdmin}
              isEditing={isEditing}
              onEdit={() => startEdit(item)}
            />
          )
        })}
      </div>
      {isAdmin && isModalVisible && (
        <Suspense
          fallback={
            <div className={styles.modalLoader} role="status" aria-live="polite">
              <span>
                {'Загрузка...'} <LoaderFallbackDots />
              </span>
            </div>
          }
        >
          <NewsAdminModal
            title={isCreating ? 'Новая новость' : 'Редактирование новости'}
            isVisible={isModalVisible}
            isClosing={isModalClosing}
            isBusy={isModalBusy}
            isDeleting={isDeleting}
            successMessage={successMessage}
            formError={formError}
            draftTitle={draftTitle}
            draftText={draftText}
            hasImage={Boolean(draftImageUrl || draftImageFile)}
            isSaving={isSaving}
            isUploading={isUploading}
            modalLoaderRef={modalLoaderRef}
            onRequestClose={requestCloseModal}
            onTitleChange={(value) => {
              setDraftTitle(value)
              setFormError('')
              setSuccessMessage('')
            }}
            onTextChange={(value) => {
              setDraftText(value)
              setFormError('')
              setSuccessMessage('')
            }}
            onImageChange={handleImageChange}
            onRemoveImage={() => {
              setDraftImageUrl('')
              setDraftImageFile(null)
              setIsImageRemoved(true)
            }}
            onSave={() => handleSave(editingId ?? undefined)}
            onDelete={typeof editingId === 'number' ? () => handleDelete(editingId) : undefined}
          />
        </Suspense>
      )}
    </section>
  )
}

