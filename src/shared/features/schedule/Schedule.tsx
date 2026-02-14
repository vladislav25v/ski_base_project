import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { supabase } from '../../lib'
import { Button, FormModal, ScheduleForm, useModalClosing } from '../../ui'
import type { ScheduleDay, ScheduleDayRecord, ScheduleDayUpsert } from '../../model'
import animationData from '../../../assets/loaders/animation (2).json'
import styles from './Schedule.module.scss'

const DAYS: Array<{ id: number; label: string }> = [
  { id: 1, label: 'Понедельник' },
  { id: 2, label: 'Вторник' },
  { id: 3, label: 'Среда' },
  { id: 4, label: 'Четверг' },
  { id: 5, label: 'Пятница' },
  { id: 6, label: 'Суббота' },
  { id: 7, label: 'Воскресенье' },
]

const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '18:00'
const PHONE_DISPLAY = '+7 (41656) 3-28-58'
const PHONE_LINK = 'tel:+74165632858'

const getDayLabel = (dayOfWeek: number) =>
  DAYS.find((day) => day.id === dayOfWeek)?.label ?? `День ${dayOfWeek}`

const buildDefaultSchedule = (): ScheduleDay[] =>
  DAYS.map((day) => ({
    dayOfWeek: day.id,
    label: day.label,
    isOpen: false,
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  }))

const mergeSchedule = (rows: ScheduleDayRecord[]): ScheduleDay[] => {
  const rowMap = new Map(rows.map((row) => [row.day_of_week, row]))

  return DAYS.map((day) => {
    const row = rowMap.get(day.id)

    return {
      dayOfWeek: day.id,
      label: day.label,
      isOpen: row?.is_open ?? false,
      startTime: row?.start_time ?? DEFAULT_START_TIME,
      endTime: row?.end_time ?? DEFAULT_END_TIME,
    }
  })
}

const getTimeLabel = (day: ScheduleDay) =>
  day.isOpen ? `${day.startTime} - ${day.endTime}` : 'Выходной'

const mapRowToDisplayDay = (row: ScheduleDayRecord): ScheduleDay => ({
  dayOfWeek: row.day_of_week,
  label: getDayLabel(row.day_of_week),
  isOpen: row.is_open,
  startTime: row.start_time ?? '',
  endTime: row.end_time ?? '',
})

export const ScheduleSection = () => {
  const [days, setDays] = useState<ScheduleDay[]>(() => buildDefaultSchedule())
  const [displayDays, setDisplayDays] = useState<ScheduleDay[]>([])
  const [hasScheduleData, setHasScheduleData] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const successCloseTimeoutRef = useRef<number | null>(null)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const modalLoaderRef = useRef<HTMLDivElement | null>(null)
  const isMountedRef = useRef(true)

  const orderedDays = useMemo(() => days, [days])
  const closeDelayMs = 220

  const fetchSchedule = async (withLoading = true) => {
    if (withLoading) {
      setIsLoading(true)
    }
    const { data, error } = await supabase
      .from('schedule')
      .select('id, day_of_week, is_open, start_time, end_time')

    if (!isMountedRef.current) {
      return
    }

    if (error) {
      setLoadError('Ошибка загрузки из бд')
      setIsLoading(false)
      return
    }

    const rows = (data ?? []) as ScheduleDayRecord[]
    setDisplayDays(rows.map(mapRowToDisplayDay))
    setHasScheduleData(rows.length > 0)
    setDays(mergeSchedule(rows))
    setIsLoading(false)
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchSchedule()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const checkAdmin = async (userId?: string) => {
      if (!userId) {
        if (isMounted) {
          setIsAdmin(false)
        }
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (!isMounted) {
        return
      }
      if (error || !data) {
        setIsAdmin(false)
        return
      }
      setIsAdmin(data.role === 'admin')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }
      const user = data.session?.user
      void checkAdmin(user?.id)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      void checkAdmin(user?.id)
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (successCloseTimeoutRef.current !== null) {
        window.clearTimeout(successCloseTimeoutRef.current)
        successCloseTimeoutRef.current = null
      }
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
      animationData,
    })

    return () => {
      animation.destroy()
    }
  }, [isLoading])

  useEffect(() => {
    if (!isSaving || !modalLoaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: modalLoaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
    })

    return () => {
      animation.destroy()
    }
  }, [isSaving])

  const setDay = (dayOfWeek: number, update: Partial<ScheduleDay>) => {
    setDays((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...update } : day)),
    )
  }

  const handleToggleDay = (dayOfWeek: number) => {
    const day = days.find((item) => item.dayOfWeek === dayOfWeek)
    if (!day) {
      return
    }
    setDay(dayOfWeek, { isOpen: !day.isOpen })
    setFormError('')
    setSuccessMessage('')
  }

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setDay(dayOfWeek, { [field]: value } as Pick<ScheduleDay, typeof field>)
    setFormError('')
    setSuccessMessage('')
  }

  const validateSchedule = () => {
    const missingTime = days.find((day) => day.isOpen && (!day.startTime || !day.endTime))
    if (missingTime) {
      return `Укажите время для "${missingTime.label}".`
    }
    const invalidTime = days.find((day) => day.isOpen && day.startTime >= day.endTime)
    if (invalidTime) {
      return `Время закрытия должно быть позже открытия для "${invalidTime.label}".`
    }
    return ''
  }

  const handleOpenEdit = () => {
    if (successCloseTimeoutRef.current !== null) {
      window.clearTimeout(successCloseTimeoutRef.current)
      successCloseTimeoutRef.current = null
    }
    setIsEditing(true)
    setFormError('')
    setSuccessMessage('')
  }

  const closeModalImmediate = () => {
    setIsEditing(false)
  }

  const { isVisible: isModalVisible, isClosing: isModalClosing, requestClose: requestCloseModal } =
    useModalClosing({
      isOpen: isEditing,
      isBusy: isSaving,
      closeDelayMs,
      onClose: closeModalImmediate,
    })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateSchedule()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setIsSaving(true)
    setFormError('')
    setSuccessMessage('')

    const payload: ScheduleDayUpsert[] = days.map((day) => ({
      day_of_week: day.dayOfWeek,
      is_open: day.isOpen,
      start_time: day.isOpen ? day.startTime : null,
      end_time: day.isOpen ? day.endTime : null,
    }))

    const { error } = await supabase.from('schedule').upsert(payload, {
      onConflict: 'day_of_week',
    })

    if (error) {
      setFormError(error.message || 'Ошибка сохранения.')
      setIsSaving(false)
      return
    }

    await fetchSchedule()
    setSuccessMessage('Сохранено')
    setIsSaving(false)
    if (successCloseTimeoutRef.current !== null) {
      window.clearTimeout(successCloseTimeoutRef.current)
    }
    successCloseTimeoutRef.current = window.setTimeout(() => {
      requestCloseModal()
    }, 1000)
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{'График работы'}</h2>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={handleOpenEdit}>
            {'Редактировать график'}
          </Button>
        )}
      </header>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {isLoading ? (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>{'Загрузка...'}</p>
        </div>
      ) : !hasScheduleData ? (
        <p className={styles.notice}>
          {'Актуальные часы работы базы уточняйте по телефону '}
          <a className={styles.phoneLink} href={PHONE_LINK}>
            {PHONE_DISPLAY}
          </a>
          {'.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {displayDays.map((day) => (
            <li className={styles.listItem} key={day.dayOfWeek}>
              <span className={styles.dayLabel}>{day.label}</span>
              <span className={day.isOpen ? styles.timeLabel : styles.dayOff}>
                {getTimeLabel(day)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <FormModal
          title="Редактировать график"
          isVisible={isModalVisible}
          isClosing={isModalClosing}
          isBusy={isSaving}
          onRequestClose={requestCloseModal}
        >
          {isSaving && (
            <div className={styles.modalLoader} role="status" aria-live="polite">
              <div className={styles.modalLoaderAnimation} ref={modalLoaderRef} />
              <span>{'Загрузка...'}</span>
            </div>
          )}
          <ScheduleForm
            days={orderedDays}
            formError={formError}
            successMessage={successMessage}
            isSaving={isSaving}
            onToggleDay={handleToggleDay}
            onTimeChange={handleTimeChange}
            onSubmit={handleSubmit}
          />
        </FormModal>
      )}
    </section>
  )
}
