import { useCallback, useEffect, useRef, useState } from 'react'

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

export const useModalClosing = ({
  isOpen,
  isBusy = false,
  closeDelayMs = 220,
  onClose,
}: UseModalClosingOptions): UseModalClosingResult => {
  const [isClosing, setIsClosing] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)

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
    setIsClosing(true)
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsClosing(false)
      onCloseRef.current()
    }, closeDelayMs)
  }, [isClosing, isBusy, closeDelayMs, clearCloseTimeout])

  useEffect(() => {
    if (isOpen || !isClosing) {
      return
    }
    clearCloseTimeout()
    setIsClosing(false)
  }, [isOpen, isClosing, clearCloseTimeout])

  useEffect(() => {
    return () => {
      clearCloseTimeout()
    }
  }, [clearCloseTimeout])

  return { isClosing, isVisible: isOpen || isClosing, requestClose }
}
