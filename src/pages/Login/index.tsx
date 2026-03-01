import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../app/store/hooks'
import { selectIsAdmin } from '../../app/store/slices/authSlice'
import { Button } from '../../shared/ui'
import styles from './Login.module.scss'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const resolveErrorMessage = (rawReason: string | null) => {
  if (!rawReason) {
    return ''
  }
  return 'Ошибка авторизации.'
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const isAdmin = useAppSelector(selectIsAdmin)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const error = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    const params = new URLSearchParams(window.location.search)
    return resolveErrorMessage(params.get('auth_error'))
  }, [])

  useEffect(() => {
    if (isAdmin) {
      navigate('/', { replace: true })
    }
  }, [isAdmin, navigate])

  const handleLogin = () => {
    if (isSubmitting) {
      return
    }
    setIsSubmitting(true)
    window.location.href = `${API_BASE_URL}/auth/yandex/start`
  }

  return (
    <section className={styles.page}>
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault()
          handleLogin()
        }}
      >
        <div>
          <h1 className={styles.title}>Вход администратора</h1>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="outline" uppercase type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </Button>
        </div>
      </form>
    </section>
  )
}

