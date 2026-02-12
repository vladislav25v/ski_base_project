import { useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Button } from '../../shared/ui'
import { supabase } from '../../shared/lib'
import styles from './News.module.scss'
import animationData from '../../assets/loaders/animation (2).json'
import animationDataYellow from '../../assets/loaders/animation_transparent_yellow_dada00.json'

type NewsItem = {
  id: number
  createdAt: string
  title: string
  text: string
  imageUrl?: string | null
}

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
  const [formError, setFormError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.body.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  const loaderRef = useRef<HTMLDivElement | null>(null)

  const orderedNews = useMemo(() => sortByNewest(news), [news])

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
        setFormError('Ошибка загрузки из бд')
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

  const handleAddNews = () => {
    setIsCreating(true)
    setEditingId(null)
    setDraftTitle('')
    setDraftText('')
    setDraftImageUrl('')
    setFormError('')
  }

  const startEdit = (item: NewsItem) => {
    setEditingId(item.id)
    setIsCreating(false)
    setDraftTitle(item.title)
    setDraftText(item.text)
    setDraftImageUrl(item.imageUrl ?? '')
    setFormError('')
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
    const payload = {
      title: trimmedTitle,
      text: trimmedText,
      image_url: draftImageUrl.trim() ? draftImageUrl.trim() : null,
    }

    if (isCreating) {
      const { data, error } = await supabase.from('news').insert(payload).select().single()
      if (error) {
        setFormError(error.message)
        setIsSaving(false)
        return
      }
      if (data) {
        setNews((current) => [
          {
            id: data.id,
            createdAt: data.created_at,
            title: data.title,
            text: data.text,
            imageUrl: data.image_url,
          },
          ...current,
        ])
      }
      setIsCreating(false)
    } else if (typeof id === 'number') {
      const { data, error } = await supabase
        .from('news')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        setFormError(error.message)
        setIsSaving(false)
        return
      }

      setNews((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                title: data.title,
                text: data.text,
                imageUrl: data.image_url,
              }
            : item,
        ),
      )
      setEditingId(null)
    }

    setFormError('')
    setIsSaving(false)
  }

  const handleDelete = async (id: number) => {
    setIsSaving(true)
    const { error } = await supabase.from('news').delete().eq('id', id)
    if (error) {
      setFormError(error.message)
      setIsSaving(false)
      return
    }

    setNews((current) => current.filter((item) => item.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setFormError('')
    }
    setIsSaving(false)
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Новости базы</h1>
          {isAdmin && (
            <Button variant="outline" onClick={handleAddNews}>
              Добавить новость
            </Button>
          )}
        </div>
      </header>
      {formError && !isCreating && editingId === null && (
        <p className={styles.error}>{formError}</p>
      )}
      {isLoading && (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>Загрузка...</p>
        </div>
      )}
      {isAdmin && isCreating && (
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.date}>Новая</span>
          </div>
          {draftImageUrl && (
            <img className={styles.image} src={draftImageUrl} alt="Новость" loading="lazy" />
          )}
          {draftTitle && <h2 className={styles.cardTitle}>{draftTitle}</h2>}
          {draftText && <p className={styles.text}>{draftText}</p>}
          <div className={styles.form}>
            <label className={styles.field}>
              <span className={styles.label}>Заголовок</span>
              <input
                className={styles.input}
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value)
                  setFormError('')
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Текст</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={draftText}
                onChange={(event) => {
                  setDraftText(event.target.value)
                  setFormError('')
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Изображение</span>
              <input
                className={styles.input}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) {
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = reader.result
                    if (typeof result === 'string') {
                      setDraftImageUrl(result)
                    }
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </label>
            {draftImageUrl && (
              <Button variant="text" onClick={() => setDraftImageUrl('')}>
                Убрать изображение
              </Button>
            )}
            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.actions}>
              <Button variant="outline" onClick={() => handleSave()} disabled={isSaving}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setIsCreating(false)
                  setDraftTitle('')
                  setDraftText('')
                  setDraftImageUrl('')
                  setFormError('')
                }}
                disabled={isSaving}
              >
                Отмена
              </Button>
            </div>
          </div>
        </article>
      )}
      <div className={styles.list}>
        {orderedNews.map((item) => {
          const isEditing = editingId === item.id

          const imageSource = isEditing ? draftImageUrl : item.imageUrl

          return (
            <article className={styles.card} key={item.id}>
              <div className={styles.cardHeader}>
                <span className={styles.date}>{formatDate(item.createdAt)}</span>
                {isAdmin && (
                  <Button size="compact" onClick={() => startEdit(item)}>
                    Редактировать
                  </Button>
                )}
              </div>
              {imageSource && (
                <img className={styles.image} src={imageSource} alt="Новость" loading="lazy" />
              )}
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <p className={styles.text}>{item.text}</p>
              {isAdmin && isEditing && (
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span className={styles.label}>Заголовок</span>
                    <input
                      className={styles.input}
                      value={draftTitle}
                      onChange={(event) => {
                        setDraftTitle(event.target.value)
                        setFormError('')
                      }}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Текст</span>
                    <textarea
                      className={styles.textarea}
                      rows={4}
                      value={draftText}
                      onChange={(event) => {
                        setDraftText(event.target.value)
                        setFormError('')
                      }}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Изображение</span>
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) {
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => {
                          const result = reader.result
                          if (typeof result === 'string') {
                            setDraftImageUrl(result)
                          }
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                  </label>
                  {draftImageUrl && (
                    <Button variant="text" onClick={() => setDraftImageUrl('')}>
                      Убрать изображение
                    </Button>
                  )}
                  {formError && <p className={styles.error}>{formError}</p>}
                  <div className={styles.actions}>
                    <Button
                      variant="outline"
                      onClick={() => handleSave(item.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(item.id)}
                      disabled={isSaving}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
