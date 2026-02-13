import { type ChangeEvent, forwardRef } from 'react'
import { Button } from '../../shared/ui'
import styles from './NewsForm.module.scss'

type NewsFormProps = {
  title: string
  text: string
  hasImage: boolean
  formError: string
  isSaving: boolean
  isUploading: boolean
  onTitleChange: (value: string) => void
  onTextChange: (value: string) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
}

export const NewsForm = forwardRef<HTMLDivElement, NewsFormProps>(
  (
    {
      title,
      text,
      hasImage,
      formError,
      isSaving,
      isUploading,
      onTitleChange,
      onTextChange,
      onImageChange,
      onRemoveImage,
      onSave,
      onCancel,
      onDelete,
    },
    ref,
  ) => (
    <div className={styles.form} ref={ref}>
      <label className={styles.field}>
        <span className={styles.label}>{'Заголовок'}</span>
        <input
          className={styles.input}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{'Текст'}</span>
        <textarea
          className={styles.textarea}
          rows={4}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{'Изображение'}</span>
        <input className={styles.input} type="file" accept="image/*" onChange={onImageChange} />
      </label>
      {hasImage && (
        <Button variant="text" onClick={onRemoveImage}>
          {'Убрать изображение'}
        </Button>
      )}
      {formError && <p className={styles.error}>{formError}</p>}
      <div className={styles.actions}>
        <Button variant="outline" onClick={onSave} disabled={isSaving || isUploading}>
          {isSaving || isUploading
            ? 'Сохранение...'
            : 'Сохранить'}
        </Button>
        {onDelete ? (
          <Button variant="danger" onClick={onDelete} disabled={isSaving || isUploading}>
            {'Удалить'}
          </Button>
        ) : (
          <Button variant="text" onClick={onCancel} disabled={isSaving || isUploading}>
            {'Отмена'}
          </Button>
        )}
      </div>
    </div>
  ),
)

NewsForm.displayName = 'NewsForm'

