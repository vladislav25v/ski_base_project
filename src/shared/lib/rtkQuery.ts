import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

type ErrorPayload = {
  error?: string
}

const isFetchBaseQueryError = (error: unknown): error is FetchBaseQueryError =>
  typeof error === 'object' && error !== null && 'status' in error

const isSerializedError = (error: unknown): error is SerializedError =>
  typeof error === 'object' && error !== null && 'message' in error

export const getRtkErrorMessage = (error: unknown, fallback = 'Ошибка запроса.') => {
  if (isFetchBaseQueryError(error)) {
    if (typeof error.status === 'number') {
      const payload = error.data as ErrorPayload | undefined
      return payload?.error ?? fallback
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error
    }
  }

  if (isSerializedError(error) && typeof error.message === 'string') {
    return error.message
  }

  return fallback
}
