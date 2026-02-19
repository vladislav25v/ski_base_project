import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Link } from 'react-router-dom'
import {
  useGetTrainingScheduleQuery,
  useUpdateTrainingScheduleMutation,
} from '../../../app/store/apiSlice'
import { useAppSelector } from '../../../app/store/hooks'
import { selectIsAdmin } from '../../../app/store/slices/authSlice'
import { selectTheme } from '../../../app/store/slices/uiSlice'
import { getRtkErrorMessage } from '../../lib/rtkQuery'
import type { TrainingDayRecord, TrainingDayUpsert } from '../../model'
import { Button, FormModal, LoaderFallbackDots, useModalClosing } from '../../ui'
import formStyles from '../../ui/forms/commonForm/CommonForm.module.scss'
import styles from './TrainingSchedule.module.scss'

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'

const DAYS: Array<{ id: number; label: string }> = [
  { id: 1, label: 'Понедельник' },
  { id: 2, label: 'Вторник' },
  { id: 3, label: 'Среда' },
  { id: 4, label: 'Четверг' },
  { id: 5, label: 'Пятница' },
  { id: 6, label: 'Суббота' },
  { id: 7, label: 'Воскресенье' },
]

type SessionForm = {
  id: string
  startTime: string
  endTime: string
}

type TrainingDay = {
  dayOfWeek: number
  label: string
  isOpen: boolean
  sessions: SessionForm[]
}

type TrainingScheduleSectionProps = {
  title?: string
  titleLinkTo?: string
  compact?: boolean
}

const createSession = (startTime = '09:00', endTime = '18:00'): SessionForm => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  startTime,
  endTime,
})

const normalizeTime = (value?: string | null) => (value ? value.slice(0, 5) : '')

const toSortedSessions = (sessions: SessionForm[]) =>
  [...sessions].sort((left, right) => left.startTime.localeCompare(right.startTime))

const buildDefaultDays = (): TrainingDay[] =>
  DAYS.map((day) => ({
    dayOfWeek: day.id,
    label: day.label,
    isOpen: false,
    sessions: [],
  }))

const mergeDays = (rows: TrainingDayRecord[]): TrainingDay[] => {
  const rowsMap = new Map(rows.map((row) => [row.day_of_week, row]))
  return DAYS.map((day) => {
    const row = rowsMap.get(day.id)
    const sessions = row?.sessions
      ? row.sessions.map((session) =>
          createSession(normalizeTime(session.start_time), normalizeTime(session.end_time)),
        )
      : []

    return {
      dayOfWeek: day.id,
      label: day.label,
      isOpen: Boolean(row?.is_open && sessions.length > 0),
      sessions: toSortedSessions(sessions),
    }
  })
}

const getSessionLabel = (session: SessionForm) => `${session.startTime} - ${session.endTime}`

export const TrainingScheduleSection = ({
  title = 'График тренировки детей',
  titleLinkTo,
  compact = false,
}: TrainingScheduleSectionProps) => {
  const [days, setDays] = useState<TrainingDay[]>(() => buildDefaultDays())
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useAppSelector(selectIsAdmin)
  const [isEditing, setIsEditing] = useState(false)
  const theme = useAppSelector(selectTheme)

  const loaderRef = useRef<HTMLDivElement | null>(null)
  const modalLoaderRef = useRef<HTMLDivElement | null>(null)
  const successCloseTimeoutRef = useRef<number | null>(null)
  const closeDelayMs = 220

  const {
    data: trainingRows = [],
    isLoading,
    isFetching,
    isError,
    error: trainingError,
  } = useGetTrainingScheduleQuery()
  const [updateTrainingSchedule] = useUpdateTrainingScheduleMutation()

  const mergedDays = useMemo(() => mergeDays(trainingRows), [trainingRows])

  const sortedDisplayDays = useMemo(
    () =>
      mergedDays.map((day) => ({
        ...day,
        sessions: toSortedSessions(day.sessions),
      })),
    [mergedDays],
  )
  const hasScheduleData = mergedDays.some((day) => day.isOpen && day.sessions.length > 0)

  const isLoadingView = isLoading || (isFetching && trainingRows.length === 0)
  const loadError = isError ? getRtkErrorMessage(trainingError, 'Ошибка загрузки из бд') : ''

  useEffect(() => {
    return () => {
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
        successCloseTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoadingView || !loaderRef.current) {
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
  }, [isLoadingView, theme])

  useEffect(() => {
    if (!isSaving || !modalLoaderRef.current) {
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
  }, [isSaving, theme])

  const openEdit = () => {
    if (successCloseTimeoutRef.current !== null) {
      window.clearTimeout(successCloseTimeoutRef.current)
      successCloseTimeoutRef.current = null
    }
    setDays(mergedDays)
    setFormError('')
    setSuccessMessage('')
    setIsEditing(true)
  }

  const closeModalImmediate = () => {
    setIsEditing(false)
  }

  const {
    isVisible: isModalVisible,
    isClosing: isModalClosing,
    requestClose: requestCloseModal,
  } = useModalClosing({
    isOpen: isEditing,
    isBusy: isSaving,
    closeDelayMs,
    onClose: closeModalImmediate,
  })

  const setDay = (dayOfWeek: number, updater: (day: TrainingDay) => TrainingDay) => {
    setDays((current) => current.map((day) => (day.dayOfWeek === dayOfWeek ? updater(day) : day)))
  }

  const handleToggleDay = (dayOfWeek: number) => {
    setDay(dayOfWeek, (day) => {
      if (day.isOpen) {
        return { ...day, isOpen: false, sessions: [] }
      }
      const nextSessions = day.sessions.length > 0 ? day.sessions : [createSession()]
      return { ...day, isOpen: true, sessions: toSortedSessions(nextSessions) }
    })
    setFormError('')
    setSuccessMessage('')
  }

  const handleSessionChange = (
    dayOfWeek: number,
    sessionId: string,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    setDay(dayOfWeek, (day) => ({
      ...day,
      sessions: day.sessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    }))
    setFormError('')
    setSuccessMessage('')
  }

  const handleAddSession = (dayOfWeek: number, sessionId: string) => {
    setDay(dayOfWeek, (day) => {
      const index = day.sessions.findIndex((session) => session.id === sessionId)
      const nextSession = createSession()
      if (index === -1) {
        return { ...day, sessions: [...day.sessions, nextSession] }
      }
      const sessions = [...day.sessions]
      sessions.splice(index + 1, 0, nextSession)
      return { ...day, sessions }
    })
    setFormError('')
    setSuccessMessage('')
  }

  const validateDays = () => {
    for (const day of days) {
      if (!day.isOpen) {
        continue
      }

      if (day.sessions.length === 0) {
        return `Добавьте хотя бы одну тренировку для "${day.label}".`
      }

      const sorted = toSortedSessions(day.sessions)
      for (let index = 0; index < sorted.length; index += 1) {
        const session = sorted[index]
        if (!session.startTime || !session.endTime) {
          return `Укажите время для "${day.label}".`
        }
        if (session.startTime >= session.endTime) {
          return `В "${day.label}" время окончания должно быть позже начала.`
        }
        if (index > 0 && sorted[index - 1].endTime > session.startTime) {
          return `В "${day.label}" интервалы не должны пересекаться.`
        }
      }
    }

    return ''
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateDays()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setIsSaving(true)
    setFormError('')
    setSuccessMessage('')

    const payload: TrainingDayUpsert[] = days.map((day) => {
      const sorted = toSortedSessions(day.sessions)
      return {
        day_of_week: day.dayOfWeek,
        is_open: day.isOpen,
        sessions: day.isOpen
          ? sorted.map((session) => ({
              start_time: session.startTime,
              end_time: session.endTime,
            }))
          : [],
      }
    })

    try {
      await updateTrainingSchedule({ days: payload }).unwrap()
      setSuccessMessage('Сохранено')
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
    }
  }

  return (
    <section className={`${styles.section} ${compact ? styles.sectionCompact : ''}`}>
      <header className={styles.header}>
        <div>
          {titleLinkTo ? (
            <Link className={styles.titleLink} to={titleLinkTo}>
              <h2 className={styles.title}>{title}</h2>
            </Link>
          ) : (
            <h2 className={styles.title}>{title}</h2>
          )}
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={openEdit}>
            {'Редактировать график'}
          </Button>
        )}
      </header>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {isLoadingView ? (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>
            {'Загрузка...'}
            {' '}
            <LoaderFallbackDots />
          </p>
        </div>
      ) : !hasScheduleData ? (
        <p className={styles.notice}>{'Пока нет добавленных тренировок.'}</p>
      ) : (
        <ul className={styles.list}>
          {sortedDisplayDays.map((day) => {
            const sessions = day.isOpen ? toSortedSessions(day.sessions) : []
            const sessionCount = Math.max(1, sessions.length)
            return (
              <li
                className={styles.listItem}
                key={day.dayOfWeek}
                style={{ '--session-count': sessionCount } as CSSProperties}
              >
                <span className={styles.dayLabel}>{day.label}</span>
                {sessions.length === 0 ? (
                  <span className={styles.dayOff}>{'Выходной'}</span>
                ) : (
                  sessions.map((session) => (
                    <span className={styles.timeCell} key={`${day.dayOfWeek}-${session.id}`}>
                      {getSessionLabel(session)}
                    </span>
                  ))
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isAdmin && (
        <FormModal
          title="Редактировать график тренировок"
          isVisible={isModalVisible}
          isClosing={isModalClosing}
          isBusy={isSaving}
          onRequestClose={requestCloseModal}
        >
          {isSaving && (
            <div className={styles.modalLoader} role="status" aria-live="polite">
              <div className={styles.modalLoaderAnimation} ref={modalLoaderRef} />
              <span>
                {'Загрузка...'}
                {' '}
                <LoaderFallbackDots />
              </span>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.formHint}>
              {'Отметьте рабочие дни и добавьте интервалы тренировок. Кнопка "+" добавляет строку для этого же дня.'}
            </p>

            {formError && <p className={formStyles.error}>{formError}</p>}
            {successMessage && <p className={formStyles.success}>{successMessage}</p>}

            <div className={styles.formList}>
              {days.map((day) => (
                <div className={styles.formDay} key={`training-form-${day.dayOfWeek}`}>
                  <div className={styles.formDayHeader}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={day.isOpen}
                        onChange={() => handleToggleDay(day.dayOfWeek)}
                      />
                      <span>{day.label}</span>
                    </label>
                    {!day.isOpen && <span className={styles.offLabel}>{'Выходной'}</span>}
                  </div>

                  {day.isOpen && (
                    <div className={styles.formSessions}>
                      {day.sessions.map((session) => (
                        <div className={styles.formSessionRow} key={session.id}>
                          <input
                            className={`${formStyles.input} ${styles.timeInput}`}
                            type="time"
                            value={session.startTime}
                            required
                            onChange={(event) =>
                              handleSessionChange(
                                day.dayOfWeek,
                                session.id,
                                'startTime',
                                event.target.value,
                              )
                            }
                          />
                          <input
                            className={`${formStyles.input} ${styles.timeInput}`}
                            type="time"
                            value={session.endTime}
                            required
                            onChange={(event) =>
                              handleSessionChange(
                                day.dayOfWeek,
                                session.id,
                                'endTime',
                                event.target.value,
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="compact"
                            onClick={() => handleAddSession(day.dayOfWeek, session.id)}
                          >
                            {'+'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.formActions}>
              <Button type="submit" variant="outline" disabled={isSaving}>
                {isSaving ? 'Сохраняем...' : 'Сохранить график'}
              </Button>
            </div>
          </form>
        </FormModal>
      )}
    </section>
  )
}
