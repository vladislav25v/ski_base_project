import type { SyntheticEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLoginMutation } from '../../app/store/apiSlice'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { selectIsAdmin, setAuthUser } from '../../app/store/slices/authSlice'
import { getRtkErrorMessage } from '../../shared/lib/rtkQuery'
import type { AuthCredentials } from '../../shared/model'
import { Button } from '../../shared/ui'
import styles from './Login.module.scss'

const emailPattern = /^\S+@\S+\.\S+$/

export const LoginPage = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const isAdmin = useAppSelector(selectIsAdmin)
  const [login] = useLoginMutation()
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
    if (isAdmin) {
      navigate('/', { replace: true })
    }
  }, [isAdmin, navigate])

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

    setIsSubmitting(true)
    const credentials: AuthCredentials = {
      email: trimmedEmail,
      password: trimmedPassword,
    }

    try {
      const data = await login(credentials).unwrap()
      if (data.user.role !== 'admin') {
        setError('Нет доступа к админке.')
        setIsSubmitting(false)
        return
      }

      dispatch(setAuthUser(data.user))
      navigate('/', { replace: true })
    } catch (loginError) {
      setError(getRtkErrorMessage(loginError, 'Ошибка авторизации.'))
      setIsSubmitting(false)
    }
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
