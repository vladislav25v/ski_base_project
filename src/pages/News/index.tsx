import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../shared/ui'
import { supabase } from '../../shared/lib'
import styles from './News.module.scss'

type NewsItem = {
  id: number
  createdAt: string
  title: string
  text: string
  imageUrl?: string | null
}

const initialNews: NewsItem[] = []

const sortByNewest = (items: NewsItem[]) =>
  [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
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
        setFormError(error.message)
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
      setFormError('Title is required.')
      return
    }
    if (!trimmedText) {
      setFormError('Text is required.')
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
          <h1 className={styles.title}>News</h1>
          {isAdmin && (
            <Button variant="outline" onClick={handleAddNews}>
              Add news
            </Button>
          )}
        </div>
        <p className={styles.subtitle}>Latest updates from the resort.</p>
      </header>
      {formError && !isCreating && editingId === null && <p className={styles.error}>{formError}</p>}
      {isLoading && <p>Loading...</p>}
      {isAdmin && isCreating && (
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.date}>New</span>
          </div>
          {draftImageUrl && (
            <img className={styles.image} src={draftImageUrl} alt="News" loading="lazy" />
          )}
          {draftTitle && <h2 className={styles.cardTitle}>{draftTitle}</h2>}
          {draftText && <p className={styles.text}>{draftText}</p>}
          <div className={styles.form}>
            <label className={styles.field}>
              <span className={styles.label}>Title</span>
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
              <span className={styles.label}>Text</span>
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
              <span className={styles.label}>Image</span>
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
                Remove image
              </Button>
            )}
            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.actions}>
              <Button variant="outline" onClick={() => handleSave()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
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
                Cancel
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
                    Edit
                  </Button>
                )}
              </div>
              {imageSource && (
                <img className={styles.image} src={imageSource} alt="News" loading="lazy" />
              )}
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <p className={styles.text}>{item.text}</p>
              {isAdmin && isEditing && (
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span className={styles.label}>Title</span>
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
                    <span className={styles.label}>Text</span>
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
                    <span className={styles.label}>Image</span>
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
                      Remove image
                    </Button>
                  )}
                  {formError && <p className={styles.error}>{formError}</p>}
                  <div className={styles.actions}>
                    <Button variant="outline" onClick={() => handleSave(item.id)} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(item.id)} disabled={isSaving}>
                      Delete
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
