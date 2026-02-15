import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Button, FormModal, NewsForm, useModalClosing } from '../../shared/ui'
import { supabase } from '../../shared/lib'
import type { NewsItem } from '../../shared/model'
import styles from './News.module.scss'
import formStyles from '../../shared/ui/forms/commonForm/CommonForm.module.scss'
import animationData from '../../assets/loaders/animation (2).json'
import animationDataYellow from '../../assets/loaders/animation_transparent_yellow_dada00.json'
import { NewsCard } from '../../shared/features/news/NewsCard'

const initialNews: NewsItem[] = []

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
  const adminUid = import.meta.env.VITE_ADMIN_UID as string | undefined
  const [news, setNews] = useState<NewsItem[]>(() => sortByNewest(initialNews))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftText, setDraftText] = useState('')
  const [draftImageUrl, setDraftImageUrl] = useState('')
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null)
  const [isImageRemoved, setIsImageRemoved] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.body.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const modalLoaderRef = useRef<HTMLDivElement | null>(null)
  const successCloseTimeoutRef = useRef<number | null>(null)

  const orderedNews = useMemo(() => sortByNewest(news), [news])
  const isModalOpen = isCreating || editingId !== null
  const isModalBusy = isSaving || isUploading
  const closeDelayMs = 220

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
    let isMounted = true

    const fetchNews = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('news')
        .select('id, created_at, title, text, image_url')
        .order('created_at', { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setFormError('Ошибка загрузки данных')
        setIsLoading(false)
        return
      }

      const items = (data ?? []).map((item) => ({
        id: item.id,
        createdAt: item.created_at,
        title: item.title,
        text: item.text,
        imageUrl: item.image_url,
      }))
      setNews(items)
      setIsLoading(false)
    }

    fetchNews()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }
      const user = data.session?.user
      setIsAdmin(!!(adminUid && user?.id === adminUid))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      setIsAdmin(!!(adminUid && user?.id === adminUid))
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [adminUid])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.body.dataset.theme === 'dark' ? 'dark' : 'light')
    })

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!isLoading || !loaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: loaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: theme === 'dark' ? animationDataYellow : animationData,
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
      animationData: theme === 'dark' ? animationDataYellow : animationData,
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
      const { data, error } = await supabase.functions.invoke('news-save', { body: formData })
      setIsUploading(false)

      if (error) {
        setFormError(error.message)
        setIsSaving(false)
        return
      }

      const payload = (data as { item?: NewsItem } | null)?.item
      if (!payload) {
        setFormError('Ошибка сохранения.')
        setIsSaving(false)
        return
      }

      if (isCreating) {
        setNews((current) => [payload, ...current])
      } else if (typeof id === 'number') {
        setNews((current) => current.map((item) => (item.id === id ? payload : item)))
      }

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка сохранения.'
      setFormError(message)
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setIsDeleting(true)
    setIsSaving(true)
    const { error } = await supabase.functions.invoke('news-delete', { body: { id } })
    if (error) {
      setFormError(error.message)
      setIsSaving(false)
      setIsDeleting(false)
      return
    }

    setNews((current) => current.filter((item) => item.id !== id))
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
      {formError && !isCreating && editingId === null && (
        <p className={styles.pageError}>{formError}</p>
      )}
      {isLoading && (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>{'Загрузка...'}</p>
        </div>
      )}
      <div className={styles.list}>
        {orderedNews.map((item) => {
          const isEditing = editingId === item.id

          return (
            <NewsCard
              key={item.id}
              item={item}
              dateLabel={formatDate(item.createdAt)}
              isAdmin={isAdmin}
              isEditing={isEditing}
              onEdit={() => startEdit(item)}
            />
          )
        })}
      </div>
      {isAdmin && (
        <FormModal
          title={isCreating ? 'Новая новость' : 'Редактирование новости'}
          isVisible={isModalVisible}
          isClosing={isModalClosing}
          isBusy={isModalBusy}
          onRequestClose={requestCloseModal}
        >
          {isModalBusy && (
            <div className={styles.modalLoader} role="status" aria-live="polite">
              <div className={styles.modalLoaderAnimation} ref={modalLoaderRef} />
              <span>{isDeleting ? 'Удаление...' : 'Загрузка...'}</span>
            </div>
          )}
          {successMessage && <p className={formStyles.success}>{successMessage}</p>}
          <NewsForm
            title={draftTitle}
            text={draftText}
            hasImage={Boolean(draftImageUrl || draftImageFile)}
            formError={formError}
            isSaving={isSaving}
            isUploading={isUploading}
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
            onCancel={requestCloseModal}
            onDelete={typeof editingId === 'number' ? () => handleDelete(editingId) : undefined}
          />
        </FormModal>
      )}
    </section>
  )
}
