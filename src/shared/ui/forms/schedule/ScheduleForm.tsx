import type { FormEvent } from 'react'
import type { ScheduleFormDay } from '../../../model'
import { Button } from '../../button'
import formStyles from '../commonForm/CommonForm.module.scss'
import styles from './ScheduleForm.module.scss'

type ScheduleFormProps = {
  days: ScheduleFormDay[]
  formError: string
  successMessage: string
  isSaving: boolean
  onToggleDay: (dayOfWeek: number) => void
  onTimeChange: (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const ScheduleForm = ({
  days,
  formError,
  successMessage,
  isSaving,
  onToggleDay,
  onTimeChange,
  onSubmit,
}: ScheduleFormProps) => (
  <form className={`${formStyles.form} ${styles.form}`} onSubmit={onSubmit}>
    <p className={styles.formHint}>
      {'Включите дни и укажите время работы. Выходные будут отмечены автоматически.'}
    </p>

    {formError && <p className={formStyles.error}>{formError}</p>}
    {successMessage && <p className={formStyles.success}>{successMessage}</p>}

    <div className={styles.formList}>
      {days.map((day) => (
        <div className={styles.formRow} key={`form-${day.dayOfWeek}`}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={day.isOpen}
              onChange={() => onToggleDay(day.dayOfWeek)}
            />
            <span>{day.label}</span>
          </label>
          <div className={styles.timeField}>
            <span className={styles.timeCaption}>{'Открытие'}</span>
            <input
              className={`${formStyles.input} ${styles.timeInput}`}
              type="time"
              value={day.startTime}
              required={day.isOpen}
              disabled={!day.isOpen}
              onChange={(event) => onTimeChange(day.dayOfWeek, 'startTime', event.target.value)}
            />
          </div>
          <div className={styles.timeField}>
            <span className={styles.timeCaption}>{'Закрытие'}</span>
            <input
              className={`${formStyles.input} ${styles.timeInput}`}
              type="time"
              value={day.endTime}
              required={day.isOpen}
              disabled={!day.isOpen}
              onChange={(event) => onTimeChange(day.dayOfWeek, 'endTime', event.target.value)}
            />
          </div>
          {!day.isOpen && <span className={styles.offLabel}>{'Выходной'}</span>}
        </div>
      ))}
    </div>

    <div className={`${formStyles.actions} ${styles.formActions}`}>
      <Button type="submit" variant="outline" disabled={isSaving}>
        {isSaving ? 'Сохраняем...' : 'Сохранить график'}
      </Button>
    </div>
  </form>
)
