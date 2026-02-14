import type { SyntheticEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../shared/ui'
import { supabase } from '../../shared/lib'
import type { AuthCredentials } from '../../shared/model'
import styles from './Login.module.scss'

const emailPattern = /^\S+@\S+\.\S+$/

export const LoginPage = () => {
  const navigate = useNavigate()
  const adminUid = import.meta.env.VITE_ADMIN_UID as string | undefined
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValid = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return false
    }
    return emailPattern.test(email.trim()) && password.trim().length >= 8
  }, [email, password])

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }
      const user = data.session?.user
      if (user && adminUid && user.id === adminUid) {
        navigate('/news', { replace: true })
      }
    })

    return () => {
      isMounted = false
    }
  }, [adminUid, navigate])

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!emailPattern.test(trimmedEmail)) {
      setError('Введите корректный email.')
      return
    }
    if (trimmedPassword.length < 8) {
      setError('Пароль должен быть минимум 8 символов.')
      return
    }
    if (!adminUid) {
      setError('Админ UID не настроен.')
      return
    }

    setIsSubmitting(true)
    const credentials: AuthCredentials = {
      email: trimmedEmail,
      password: trimmedPassword,
    }
    const { data, error: signInError } = await supabase.auth.signInWithPassword(credentials)
    if (signInError) {
      setError(signInError.message)
      setIsSubmitting(false)
      return
    }

    const user = data.user
    if (!user || user.id !== adminUid) {
      await supabase.auth.signOut()
      setError('Нет доступа к админке.')
      setIsSubmitting(false)
      return
    }

    navigate('/news', { replace: true })
  }

  return (
    <section className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div>
          <h1 className={styles.title}>Вход администратора</h1>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Эл. почта</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
            autoComplete="email"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Пароль</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            autoComplete="current-password"
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="outline" uppercase type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </Button>
        </div>
      </form>
    </section>
  )
}
