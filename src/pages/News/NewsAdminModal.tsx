import type { ChangeEvent, RefObject } from 'react'
import { FormModal } from '../../shared/ui/modal'
import { NewsForm } from '../../shared/ui/forms/news'
import { LoaderFallbackDots } from '../../shared/ui/loader'
import styles from './News.module.scss'
import formStyles from '../../shared/ui/forms/commonForm/CommonForm.module.scss'

type NewsAdminModalProps = {
  title: string
  isVisible: boolean
  isClosing: boolean
  isBusy: boolean
  isDeleting: boolean
  successMessage: string
  formError: string
  draftTitle: string
  draftText: string
  hasImage: boolean
  isSaving: boolean
  isUploading: boolean
  modalLoaderRef: RefObject<HTMLDivElement | null>
  onRequestClose: () => void
  onTitleChange: (value: string) => void
  onTextChange: (value: string) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  onSave: () => void
  onDelete?: () => void
}

export const NewsAdminModal = ({
  title,
  isVisible,
  isClosing,
  isBusy,
  isDeleting,
  successMessage,
  formError,
  draftTitle,
  draftText,
  hasImage,
  isSaving,
  isUploading,
  modalLoaderRef,
  onRequestClose,
  onTitleChange,
  onTextChange,
  onImageChange,
  onRemoveImage,
  onSave,
  onDelete,
}: NewsAdminModalProps) => (
  <FormModal
    title={title}
    isVisible={isVisible}
    isClosing={isClosing}
    isBusy={isBusy}
    onRequestClose={onRequestClose}
  >
    {isBusy && (
      <div className={styles.modalLoader} role="status" aria-live="polite">
        <div className={styles.modalLoaderAnimation} ref={modalLoaderRef} />
        <span>
          {isDeleting ? 'Удаление...' : 'Загрузка...'} <LoaderFallbackDots />
        </span>
      </div>
    )}
    {successMessage && <p className={formStyles.success}>{successMessage}</p>}
    <NewsForm
      title={draftTitle}
      text={draftText}
      hasImage={hasImage}
      formError={formError}
      isSaving={isSaving}
      isUploading={isUploading}
      onTitleChange={onTitleChange}
      onTextChange={onTextChange}
      onImageChange={onImageChange}
      onRemoveImage={onRemoveImage}
      onSave={onSave}
      onCancel={onRequestClose}
      onDelete={onDelete}
    />
  </FormModal>
)
