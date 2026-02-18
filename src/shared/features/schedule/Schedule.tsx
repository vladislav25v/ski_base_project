import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { Link } from 'react-router-dom'
import { useGetScheduleQuery, useUpdateScheduleMutation } from '../../../app/store/apiSlice'
import { useAppSelector } from '../../../app/store/hooks'
import { selectIsAdmin } from '../../../app/store/slices/authSlice'
import { selectTheme } from '../../../app/store/slices/uiSlice'
import { getRtkErrorMessage } from '../../lib/rtkQuery'
import type { ScheduleDay, ScheduleDayRecord, ScheduleDayUpsert } from '../../model'
import { Button, FormModal, ScheduleForm, useModalClosing } from '../../ui'
import animationData from '../../../assets/loaders/animation (2).json'
import animationDataYellow from '../../../assets/loaders/animation_transparent_yellow_dada00.json'
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

const normalizeTime = (value?: string | null) => (value ? value.slice(0, 5) : '')

const mergeSchedule = (rows: ScheduleDayRecord[]): ScheduleDay[] => {
  const rowMap = new Map(rows.map((row) => [row.day_of_week, row]))

  return DAYS.map((day) => {
    const row = rowMap.get(day.id)

    return {
      dayOfWeek: day.id,
      label: day.label,
      isOpen: row?.is_open ?? false,
      startTime: row?.start_time ? normalizeTime(row.start_time) : DEFAULT_START_TIME,
      endTime: row?.end_time ? normalizeTime(row.end_time) : DEFAULT_END_TIME,
    }
  })
}

const getTimeLabel = (day: ScheduleDay) =>
  day.isOpen ? `${day.startTime} - ${day.endTime}` : 'Выходной'

const mapRowToDisplayDay = (row: ScheduleDayRecord): ScheduleDay => ({
  dayOfWeek: row.day_of_week,
  label: getDayLabel(row.day_of_week),
  isOpen: row.is_open,
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
})

type ScheduleSectionProps = {
  title?: string
  titleLinkTo?: string
  apiPath?: '/schedule' | '/training-schedule'
  compact?: boolean
}

export const ScheduleSection = ({
  title = 'График работы',
  titleLinkTo,
  apiPath = '/schedule',
  compact = false,
}: ScheduleSectionProps) => {
  const [days, setDays] = useState<ScheduleDay[]>(() => buildDefaultSchedule())
  const [displayDays, setDisplayDays] = useState<ScheduleDay[]>([])
  const [hasScheduleData, setHasScheduleData] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useAppSelector(selectIsAdmin)
  const [isEditing, setIsEditing] = useState(false)
  const theme = useAppSelector(selectTheme)
  const successCloseTimeoutRef = useRef<number | null>(null)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const modalLoaderRef = useRef<HTMLDivElement | null>(null)

  const {
    data: scheduleRows = [],
    isLoading,
    isFetching,
    isError,
    error: scheduleError,
  } = useGetScheduleQuery(apiPath)
  const [updateSchedule] = useUpdateScheduleMutation()

  useEffect(() => {
    setDisplayDays(scheduleRows.map(mapRowToDisplayDay))
    setHasScheduleData(scheduleRows.length > 0)
    setDays(mergeSchedule(scheduleRows))
  }, [scheduleRows])

  const orderedDays = useMemo(() => days, [days])
  const closeDelayMs = 220
  const loadError = isError ? getRtkErrorMessage(scheduleError, 'Ошибка загрузки из бд') : ''
  const isLoadingView = isLoading || (isFetching && scheduleRows.length === 0)

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
      animationData: theme === 'dark' ? animationDataYellow : animationData,
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
      animationData: theme === 'dark' ? animationDataYellow : animationData,
    })

    return () => {
      animation.destroy()
    }
  }, [isSaving, theme])

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

    try {
      await updateSchedule({ path: apiPath, days: payload }).unwrap()
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
          <Button variant="outline" onClick={handleOpenEdit}>
            {'Редактировать график'}
          </Button>
        )}
      </header>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {isLoadingView ? (
        <div className={styles.loader} role="status" aria-live="polite">
          <div className={styles.loaderAnimation} ref={loaderRef} />
          <p className={styles.loaderText}>{'Загрузка...'}</p>
        </div>
      ) : !hasScheduleData ? (
        <p className={styles.notice}>
          {'Актуальные часы работы уточняйте по телефону '}
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
