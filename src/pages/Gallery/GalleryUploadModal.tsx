import type { ChangeEvent, RefObject } from 'react'
import { FormModal } from '../../shared/ui/modal'
import { Button } from '../../shared/ui/button'
import { LoaderFallbackDots } from '../../shared/ui/loader'
import styles from './Gallery.module.scss'
import formStyles from '../../shared/ui/forms/commonForm/CommonForm.module.scss'

type GalleryUploadModalProps = {
  isVisible: boolean
  isClosing: boolean
  isBusy: boolean
  successMessage: string
  formError: string
  uploadInputKey: number
  uploadCaption: string
  uploadFiles: File[]
  modalLoaderRef: RefObject<HTMLDivElement | null>
  onRequestClose: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onCaptionChange: (value: string) => void
  onUpload: () => void
}

export const GalleryUploadModal = ({
  isVisible,
  isClosing,
  isBusy,
  successMessage,
  formError,
  uploadInputKey,
  uploadCaption,
  uploadFiles,
  modalLoaderRef,
  onRequestClose,
  onFileChange,
  onCaptionChange,
  onUpload,
}: GalleryUploadModalProps) => (
  <FormModal
    title="Добавить фото"
    isVisible={isVisible}
    isClosing={isClosing}
    isBusy={isBusy}
    onRequestClose={onRequestClose}
  >
    {isBusy && (
      <div className={styles.modalLoader} role="status" aria-live="polite">
        <div className={styles.modalLoaderAnimation} ref={modalLoaderRef} />
        <span>
          {'Загрузка...'} <LoaderFallbackDots />
        </span>
      </div>
    )}
    {successMessage && <p className={formStyles.success}>{successMessage}</p>}
    <div className={formStyles.form}>
      <label className={formStyles.field}>
        <span className={formStyles.label}>{'Изображение'}</span>
        <input
          className={formStyles.input}
          type="file"
          key={uploadInputKey}
          accept="image/*"
          onChange={onFileChange}
          multiple
          disabled={isBusy}
        />
        <span className={styles.uploadHint}>{'Максимум 10 МБ, только изображения.'}</span>
        {uploadFiles.length > 0 && (
          <span className={styles.fileName}>
            {uploadFiles.length === 1
              ? uploadFiles[0].name
              : `Выбрано файлов: ${uploadFiles.length}`}
          </span>
        )}
      </label>
      <label className={formStyles.field}>
        <span className={formStyles.label}>{'Подпись (опционально)'}</span>
        <input
          className={formStyles.input}
          type="text"
          value={uploadCaption}
          onChange={(event) => onCaptionChange(event.target.value)}
          disabled={isBusy}
        />
      </label>
      {formError && <p className={formStyles.error}>{formError}</p>}
      <div className={formStyles.actions}>
        <Button onClick={onUpload} disabled={isBusy}>
          {'Загрузить'}
        </Button>
        <Button variant="outline" onClick={onRequestClose} disabled={isBusy}>
          {'Отмена'}
        </Button>
      </div>
    </div>
  </FormModal>
)
