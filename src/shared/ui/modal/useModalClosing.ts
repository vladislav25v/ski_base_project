import { useCallback, useEffect, useReducer, useRef } from 'react'

type UseModalClosingOptions = {
  isOpen: boolean
  isBusy?: boolean
  closeDelayMs?: number
  onClose: () => void
}

type UseModalClosingResult = {
  isClosing: boolean
  isVisible: boolean
  requestClose: () => void
}

type ClosingPhase = 'idle' | 'closing'

type ClosingAction =
  | { type: 'START_CLOSING' }
  | { type: 'RESET' }

const closingReducer = (state: ClosingPhase, action: ClosingAction): ClosingPhase => {
  switch (action.type) {
    case 'START_CLOSING':
      return state === 'closing' ? state : 'closing'
    case 'RESET':
      return 'idle'
    default:
      return state
  }
}

export const useModalClosing = ({
  isOpen,
  isBusy = false,
  closeDelayMs = 220,
  onClose,
}: UseModalClosingOptions): UseModalClosingResult => {
  const [phase, dispatch] = useReducer(closingReducer, 'idle')
  const closeTimeoutRef = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  const isClosing = phase === 'closing'

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const requestClose = useCallback(() => {
    if (isClosing || isBusy) {
      return
    }
    clearCloseTimeout()
    dispatch({ type: 'START_CLOSING' })
    closeTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: 'RESET' })
      onCloseRef.current()
    }, closeDelayMs)
  }, [isClosing, isBusy, closeDelayMs, clearCloseTimeout])

  useEffect(() => {
    if (isOpen) {
      return
    }
    clearCloseTimeout()
  }, [isOpen, clearCloseTimeout])

  useEffect(() => {
    return () => {
      clearCloseTimeout()
    }
  }, [clearCloseTimeout])

  return { isClosing, isVisible: isOpen || isClosing, requestClose }
}
