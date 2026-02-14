import { type ChangeEvent, forwardRef } from 'react'
import { Button } from '../../button'
import formStyles from '../commonForm/CommonForm.module.scss'

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
    <div className={formStyles.form} ref={ref}>
      <label className={formStyles.field}>
        <span className={formStyles.label}>{'Заголовок'}</span>
        <input
          className={formStyles.input}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <label className={formStyles.field}>
        <span className={formStyles.label}>{'Текст'}</span>
        <textarea
          className={formStyles.textarea}
          rows={4}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <label className={formStyles.field}>
        <span className={formStyles.label}>{'Изображение'}</span>
        <input
          className={formStyles.input}
          type="file"
          accept="image/*"
          onChange={onImageChange}
        />
      </label>
      {hasImage && (
        <Button variant="text" onClick={onRemoveImage}>
          {'Убрать изображение'}
        </Button>
      )}
      {formError && <p className={formStyles.error}>{formError}</p>}
      <div className={formStyles.actions}>
        <Button variant="outline" onClick={onSave} disabled={isSaving || isUploading}>
          {isSaving || isUploading ? 'Сохранение...' : 'Сохранить'}
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
