import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useAppSelector } from '../../app/store/hooks'
import { selectIsAdmin } from '../../app/store/slices/authSlice'
import { apiClient } from '../../shared/lib/apiClient'
import type { ProtocolItem, ProtocolStatus } from '../../shared/model'
import { Button, Input } from '../../shared/ui'
import styles from './Protocols.module.scss'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const LOCAL_STORAGE_KEY = 'protocols.local.v2'
const LOCAL_SCHEMA_VERSION = 3
const MAX_PROTOCOL_FILE_SIZE = 10 * 1024 * 1024
const NAME_PATTERN = /^[\p{L}\s'-]+$/u
const ALLOWED_PROTOCOL_FILE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx']

type ParticipantForm = {
  number: number
  lastName: string
  startTime: string
  finishTime: string
  dsq: boolean
  lapTimes: string[]
}

type ProtocolForm = {
  title: string
  formationDate: string
  startIntervalSeconds: number
  chiefJudgeName: string
  secretaryName: string
  participants: ParticipantForm[]
}

type EditingSource =
  | null
  | { kind: 'new' }
  | { kind: 'remote'; id: string }
  | { kind: 'local'; localId: string }
type FieldErrors = Record<string, string>

type LocalProtocolRecord = {
  schemaVersion: number
  localId: string
  status: Extract<ProtocolStatus, 'DRAFT' | 'FORMED' | 'PUBLISHED'>
  sortByNetTime: boolean
  formedAt: string | null
  formedFileName: string | null
  createdAt: string
  updatedAt: string
  payload: ProtocolForm
}

type UploadProtocolForm = {
  title: string
  formationDate: string
  file: File | null
}

type TimeFieldKind = 'startTime' | 'finishTime' | 'lap'
type UploadFieldErrors = Record<'title' | 'formationDate' | 'file', string>

const emptyParticipant = (number = 1): ParticipantForm => ({
  number,
  lastName: '',
  startTime: '',
  finishTime: '',
  dsq: false,
  lapTimes: [],
})

const emptyForm = (): ProtocolForm => ({
  title: '',
  formationDate: new Date().toISOString().slice(0, 10),
  startIntervalSeconds: 30,
  chiefJudgeName: '',
  secretaryName: '',
  participants: [emptyParticipant(1)],
})

const emptyUploadForm = (): UploadProtocolForm => ({
  title: '',
  formationDate: new Date().toISOString().slice(0, 10),
  file: null,
})

const parseTimeToSec = (value: string): number | null => {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (hours > 23) return null
  return hours * 3600 + minutes * 60 + seconds
}

const formatSecToTime = (value: number | null) => {
  if (typeof value !== 'number') return ''
  const h = Math.floor(value / 3600)
  const m = Math.floor((value % 3600) / 60)
  const s = value % 60
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':')
}

const maskTimeInput = (raw: string): { value: string; error: string } => {
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  let value = digits
  if (digits.length > 2 && digits.length <= 4) value = `${digits.slice(0, 2)}:${digits.slice(2)}`
  if (digits.length > 4) value = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`

  let error = ''
  if (digits.length >= 2 && Number(digits.slice(0, 2)) > 23) error = 'Часы должны быть от 00 до 23.'
  if (!error && digits.length >= 4 && Number(digits.slice(2, 4)) > 59)
    error = 'Минуты должны быть от 00 до 59.'
  if (!error && digits.length === 6 && Number(digits.slice(4, 6)) > 59)
    error = 'Секунды должны быть от 00 до 59.'
  return { value, error }
}

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ')

const getFinishBeforeStartError = (participant: ParticipantForm) => {
  if (participant.dsq) return ''
  const start = parseTimeToSec(participant.startTime)
  const finish = parseTimeToSec(participant.finishTime)
  if (start === null || finish === null) return ''
  if (finish < start) {
    return '\u0413\u0440\u044f\u0437\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043c\u0435\u043d\u044c\u0448\u0435 \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u0441\u0442\u0430\u0440\u0442\u0430.'
  }
  return ''
}

const computeNet = (participant: ParticipantForm) => {
  if (participant.dsq) return null
  const start = parseTimeToSec(participant.startTime)
  const finish = parseTimeToSec(participant.finishTime)
  if (start === null || finish === null || finish < start) return null
  return finish - start
}

const sortParticipants = (participants: ParticipantForm[], byNetTime: boolean) => {
  const withIndex = participants.map((participant, index) => ({ participant, index }))
  return withIndex
    .sort((left, right) => {
      if (byNetTime) {
        if (left.participant.dsq !== right.participant.dsq) return left.participant.dsq ? 1 : -1
        const leftNet = computeNet(left.participant)
        const rightNet = computeNet(right.participant)
        const byTime = (leftNet ?? Number.MAX_SAFE_INTEGER) - (rightNet ?? Number.MAX_SAFE_INTEGER)
        if (byTime !== 0) return byTime
      }
      const byNumber = left.participant.number - right.participant.number
      if (byNumber !== 0) return byNumber
      return left.index - right.index
    })
    .map((item) => item.participant)
}

const maxLaps = (form: ProtocolForm) =>
  form.participants.reduce((max, participant) => Math.max(max, participant.lapTimes.length), 0)

const toForm = (item: ProtocolItem): ProtocolForm => {
  const laps = item.participants.reduce(
    (max, participant) => Math.max(max, participant.lapTimes.length),
    0,
  )
  return {
    title: item.title,
    formationDate: item.formationDate.slice(0, 10),
    startIntervalSeconds: item.startIntervalSeconds,
    chiefJudgeName: item.chiefJudgeName ?? '',
    secretaryName: item.secretaryName ?? '',
    participants: item.participants.map((participant) => ({
      number: participant.number ?? participant.sortOrder ?? 1,
      lastName: participant.lastName,
      startTime: formatSecToTime(participant.startTimeSec),
      finishTime: formatSecToTime(participant.finishTimeSec),
      dsq: participant.dsq,
      lapTimes: Array.from({ length: laps }, (_v, idx) =>
        formatSecToTime(participant.lapTimes[idx] ?? null),
      ),
    })),
  }
}

const validateForm = (form: ProtocolForm) => {
  if (!form.title.trim() || form.title.trim().length > 160)
    return 'Введите название протокола (1-160 символов).'
  if (!form.formationDate || Number.isNaN(new Date(form.formationDate).getTime()))
    return 'Укажите дату формирования.'
  if (
    !Number.isInteger(form.startIntervalSeconds) ||
    form.startIntervalSeconds < 5 ||
    form.startIntervalSeconds > 600
  )
    return 'Интервал старта: 5-600 секунд.'
  if (form.chiefJudgeName.trim() && !NAME_PATTERN.test(normalizeName(form.chiefJudgeName)))
    return 'Некорректное ФИО главного судьи.'
  if (form.secretaryName.trim() && !NAME_PATTERN.test(normalizeName(form.secretaryName)))
    return 'Некорректное ФИО секретаря.'
  const participants = form.participants.filter((participant) => participant.lastName.trim())
  if (participants.length === 0) return 'Добавьте хотя бы одного участника.'
  for (let i = 0; i < participants.length; i += 1) {
    const participant = participants[i]
    if (!NAME_PATTERN.test(normalizeName(participant.lastName)))
      return `Участник ${i + 1}: некорректная фамилия.`
    if (participant.startTime && parseTimeToSec(participant.startTime) === null)
      return `Участник ${i + 1}: некорректное время старта.`
    if (participant.finishTime && parseTimeToSec(participant.finishTime) === null)
      return `\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a ${i + 1}: \u043d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u0444\u0438\u043d\u0438\u0448\u0430.`
    const finishBeforeStartError = getFinishBeforeStartError(participant)
    if (finishBeforeStartError) return `\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a ${i + 1}: ${finishBeforeStartError}`
  }
  return ''
}

const validateFormDetailed = (form: ProtocolForm) => {
  const fieldErrors: FieldErrors = {}

  if (!form.title.trim() || form.title.trim().length > 160) {
    fieldErrors.title = 'Введите название протокола (1-160 символов).'
  }
  if (!form.formationDate || Number.isNaN(new Date(form.formationDate).getTime())) {
    fieldErrors.formationDate = 'Укажите дату формирования.'
  }
  if (
    !Number.isInteger(form.startIntervalSeconds) ||
    form.startIntervalSeconds < 5 ||
    form.startIntervalSeconds > 600
  ) {
    fieldErrors.startIntervalSeconds = 'Интервал старта: 5-600 секунд.'
  }
  if (form.chiefJudgeName.trim() && !NAME_PATTERN.test(normalizeName(form.chiefJudgeName))) {
    fieldErrors.chiefJudgeName = 'Некорректное ФИО главного судьи.'
  }
  if (form.secretaryName.trim() && !NAME_PATTERN.test(normalizeName(form.secretaryName))) {
    fieldErrors.secretaryName = 'Некорректное ФИО секретаря.'
  }

  const participants = form.participants.filter((participant) => participant.lastName.trim())
  if (participants.length === 0) {
    return {
      message: 'Добавьте хотя бы одного участника.',
      fieldErrors,
    }
  }

  for (let i = 0; i < form.participants.length; i += 1) {
    const participant = form.participants[i]
    if (participant.number < 1 || !Number.isInteger(participant.number)) {
      fieldErrors[`participant-${i}-number`] = 'Номер участника должен быть больше 0.'
    }
    if (participant.lastName.trim() && !NAME_PATTERN.test(normalizeName(participant.lastName))) {
      fieldErrors[`participant-${i}-lastName`] = `Участник ${i + 1}: некорректная фамилия.`
    }
    if (participant.startTime && parseTimeToSec(participant.startTime) === null) {
      fieldErrors[`participant-${i}-startTime`] = `Участник ${i + 1}: некорректное время старта.`
    }
    if (participant.finishTime && parseTimeToSec(participant.finishTime) === null) {
      fieldErrors[`participant-${i}-finishTime`] = `Участник ${i + 1}: некорректное время финиша.`
    }
    const finishBeforeStartError = getFinishBeforeStartError(participant)
    if (finishBeforeStartError) {
      fieldErrors[`participant-${i}-finishTime`] = `\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a ${i + 1}: ${finishBeforeStartError}`
    }
  }

  return {
    message: Object.values(fieldErrors)[0] ?? validateForm(form),
    fieldErrors,
  }
}

const validateUploadForm = (form: UploadProtocolForm) => {
  const fieldErrors: Partial<UploadFieldErrors> = {}

  if (!form.title.trim() || form.title.trim().length > 160) {
    fieldErrors.title = 'Введите название протокола (1-160 символов).'
  }
  if (!form.formationDate || Number.isNaN(new Date(form.formationDate).getTime())) {
    fieldErrors.formationDate = 'Укажите дату формирования.'
  }
  if (!form.file) {
    fieldErrors.file = 'Выберите файл протокола.'
  } else {
    const extension = form.file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_PROTOCOL_FILE_EXTENSIONS.includes(extension)) {
      fieldErrors.file = 'Допустимы только файлы DOC, DOCX, XLS Рё XLSX.'
    } else if (form.file.size > MAX_PROTOCOL_FILE_SIZE) {
      fieldErrors.file = 'Файл превышает 10 МБ.'
    }
  }

  return {
    message: fieldErrors.title ?? fieldErrors.formationDate ?? fieldErrors.file ?? '',
    fieldErrors,
  }
}

const formToPayload = (form: ProtocolForm, sortByNetTime: boolean, localSourceId?: string) => ({
  title: form.title.trim(),
  formationDate: new Date(form.formationDate).toISOString(),
  startIntervalSeconds: form.startIntervalSeconds,
  sortByNetTime,
  chiefJudgeName: form.chiefJudgeName.trim() ? normalizeName(form.chiefJudgeName) : null,
  secretaryName: form.secretaryName.trim() ? normalizeName(form.secretaryName) : null,
  localSourceId: localSourceId ?? null,
  participants: form.participants
    .filter((participant) => participant.lastName.trim())
    .map((participant) => ({
      number: participant.number,
      lastName: normalizeName(participant.lastName),
      startTimeSec: parseTimeToSec(participant.startTime),
      finishTimeSec: parseTimeToSec(participant.finishTime),
      netTimeSec: computeNet(participant),
      dsq: participant.dsq,
      lapTimes: participant.lapTimes.map((lap) => parseTimeToSec(lap)),
    })),
})

const protocolSort = (items: ProtocolItem[]) =>
  [...items].sort((left, right) => {
    const byDate = new Date(right.formationDate).getTime() - new Date(left.formationDate).getTime()
    if (byDate !== 0) return byDate
    return left.title.localeCompare(right.title, 'ru-RU')
  })

const readLocalRecords = (): LocalProtocolRecord[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<LocalProtocolRecord>
      if (
        (candidate.schemaVersion !== 2 && candidate.schemaVersion !== LOCAL_SCHEMA_VERSION) ||
        typeof candidate.localId !== 'string' ||
        !candidate.payload
      ) {
        return []
      }
      return [
        {
          ...(candidate as LocalProtocolRecord),
          schemaVersion: LOCAL_SCHEMA_VERSION,
          status: 'DRAFT',
          formedAt: null,
          formedFileName: null,
          sortByNetTime: candidate.sortByNetTime ?? false,
        },
      ]
    })
  } catch {
    return []
  }
}

const writeLocalRecords = (items: LocalProtocolRecord[]) => {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
}

const openPdfBlob = (blob: Blob) => {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const ProtocolsPage = () => {
  const isAdmin = useAppSelector(selectIsAdmin)
  const [published, setPublished] = useState<ProtocolItem[]>([])
  const [drafts, setDrafts] = useState<ProtocolItem[]>([])
  const [localRecords, setLocalRecords] = useState<LocalProtocolRecord[]>([])
  const [editing, setEditing] = useState<EditingSource>(null)
  const [form, setForm] = useState<ProtocolForm>(emptyForm())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [sortByNet, setSortByNet] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [uploadForm, setUploadForm] = useState<UploadProtocolForm>(emptyUploadForm())
  const [uploadFieldErrors, setUploadFieldErrors] = useState<Partial<UploadFieldErrors>>({})
  const [showUploadCard, setShowUploadCard] = useState(false)
  const [timeErrors, setTimeErrors] = useState<Record<string, string>>({})

  const laps = useMemo(() => maxLaps(form), [form])
  const publishedSorted = useMemo(() => protocolSort(published), [published])
  const draftsSorted = useMemo(() => protocolSort(drafts), [drafts])
  const localSorted = useMemo(
    () =>
      [...localRecords].sort(
        (left, right) =>
          new Date(right.payload.formationDate).getTime() -
          new Date(left.payload.formationDate).getTime(),
      ),
    [localRecords],
  )

  const syncLocal = (records: LocalProtocolRecord[]) => {
    setLocalRecords(records)
    writeLocalRecords(records)
  }

  const saveLocalDraftRecord = (payload: ProtocolForm) => {
    const now = new Date().toISOString()
    if (editing?.kind === 'local') {
      const next = localRecords.map((record) =>
        record.localId === editing.localId
          ? {
              ...record,
              status: 'DRAFT' as const,
              formedAt: null,
              formedFileName: null,
              updatedAt: now,
              payload,
              sortByNetTime: sortByNet,
            }
          : record,
      )
      syncLocal(next)
      return editing.localId
    }

    const localId = crypto.randomUUID()
    const record: LocalProtocolRecord = {
      schemaVersion: LOCAL_SCHEMA_VERSION,
      localId,
      status: 'DRAFT',
      sortByNetTime: sortByNet,
      formedAt: null,
      formedFileName: null,
      createdAt: now,
      updatedAt: now,
      payload,
    }
    syncLocal([record, ...localRecords])
    setEditing({ kind: 'local', localId })
    return localId
  }

  const fetchPublished = useCallback(async () => {
    const response = await apiClient.get<{ items: ProtocolItem[] }>('/protocols/published')
    if (response.error) return setError(response.error.message)
    setPublished(response.data?.items ?? [])
  }, [])

  const fetchDrafts = useCallback(async () => {
    if (!isAdmin) {
      setDrafts([])
      return
    }
    const response = await apiClient.get<{ items: ProtocolItem[] }>('/protocols/drafts')
    if (response.error) return setError(response.error.message)
    setDrafts(response.data?.items ?? [])
  }, [isAdmin])

  const reload = useCallback(async () => {
    await fetchPublished()
    await fetchDrafts()
  }, [fetchPublished, fetchDrafts])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setLocalRecords(readLocalRecords())
  }, [])

  const resetEditor = () => {
    setEditing(null)
    setForm(emptyForm())
    setSortByNet(false)
    setFieldErrors({})
    setTimeErrors({})
    setError('')
    setNotice('')
  }

  const getTimeErrorKey = (participantIndex: number, field: TimeFieldKind, lapIndex?: number) =>
    field === 'lap'
      ? `participant-${participantIndex}-lap-${lapIndex ?? 0}`
      : `participant-${participantIndex}-${field}`

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const clearUploadFieldError = (key: keyof UploadFieldErrors) => {
    setUploadFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const updateParticipant = (index: number, patch: Partial<ParticipantForm>) => {
    setForm((state) => ({
      ...state,
      participants: state.participants.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, ...patch } : participant,
      ),
    }))
  }

  const handleTimeInputChange = (
    index: number,
    rawValue: string,
    field: TimeFieldKind,
    lapIndex?: number,
  ) => {
    const key = getTimeErrorKey(index, field, lapIndex)
    if (field !== 'lap') {
      clearFieldError(`participant-${index}-${field}`)
    }
    const masked = maskTimeInput(rawValue)
    setTimeErrors((current) => {
      const next = { ...current }
      if (masked.error) next[key] = masked.error
      else delete next[key]

      const currentParticipant = form.participants[index]
      const nextParticipant: ParticipantForm =
        field === 'lap'
          ? currentParticipant
          : {
              ...currentParticipant,
              [field]: masked.value,
            }
      const finishOrderKey = getTimeErrorKey(index, 'finishTime')
      const finishBeforeStartError = getFinishBeforeStartError(nextParticipant)
      if (finishBeforeStartError) next[finishOrderKey] = finishBeforeStartError
      else if (finishOrderKey !== key || !masked.error) delete next[finishOrderKey]
      return next
    })
    if (field === 'startTime' || field === 'finishTime') {
      updateParticipant(index, { [field]: masked.value } as Partial<ParticipantForm>)
      return
    }
    updateParticipant(index, {
      lapTimes: Array.from({ length: laps }, (_v, idx) =>
        idx === lapIndex ? masked.value : (form.participants[index]?.lapTimes[idx] ?? ''),
      ),
    })
  }

  const applySortByNet = () => {
    setForm((state) => ({ ...state, participants: sortParticipants(state.participants, true) }))
  }

  const applySortByNumber = () => {
    setForm((state) => ({ ...state, participants: sortParticipants(state.participants, false) }))
  }

  const addLapColumn = () => {
    setForm((state) => ({
      ...state,
      participants: state.participants.map((participant) => ({
        ...participant,
        lapTimes: [...participant.lapTimes, ''],
      })),
    }))
  }

  const removeLapColumn = () => {
    if (laps === 0) return
    setForm((state) => ({
      ...state,
      participants: state.participants.map((participant) => ({
        ...participant,
        lapTimes: participant.lapTimes.slice(0, -1),
      })),
    }))
  }

  const addParticipant = () => {
    setForm((state) => ({
      ...state,
      participants: [
        ...state.participants,
        {
          ...emptyParticipant(
            Math.max(0, ...state.participants.map((participant) => participant.number)) + 1,
          ),
          lapTimes: Array.from({ length: laps }, () => ''),
        },
      ],
    }))
  }

  const updateParticipantNumber = (index: number, rawValue: string) => {
    const nextValue = Number(rawValue)
    if (!Number.isFinite(nextValue)) return
    const normalized = Math.max(1, Math.trunc(nextValue))
    setForm((state) => {
      const nextParticipants = state.participants.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, number: normalized } : participant,
      )
      return {
        ...state,
        participants: sortParticipants(nextParticipants, sortByNet),
      }
    })
  }

  const applyStartInterval = () => {
    const firstStart = parseTimeToSec(form.participants[0]?.startTime || '')
    if (firstStart === null) return
    setForm((state) => ({
      ...state,
      participants: state.participants.map((participant, index) => ({
        ...participant,
        startTime: formatSecToTime(firstStart + index * state.startIntervalSeconds),
      })),
    }))
  }

  const saveDraft = async () => {
    const validation = validateFormDetailed(form)
    setFieldErrors(validation.fieldErrors)
    if (validation.message) {
      setError(validation.message)
      return
    }
    setBusy(true)
    setFieldErrors({})
    setError('')
    setNotice('')
    try {
      if (!isAdmin) {
        const now = new Date().toISOString()
        if (editing?.kind === 'local') {
          const next = localRecords.map((record) =>
            record.localId === editing.localId
              ? { ...record, payload: form, updatedAt: now, status: 'DRAFT' as const }
              : record,
          )
          const synced = next.map((record) =>
            record.localId === editing.localId ? { ...record, sortByNetTime: sortByNet } : record,
          )
          syncLocal(synced)
        } else {
          const localId = crypto.randomUUID()
          const record: LocalProtocolRecord = {
            schemaVersion: LOCAL_SCHEMA_VERSION,
            localId,
            status: 'DRAFT',
            sortByNetTime: sortByNet,
            formedAt: null,
            formedFileName: null,
            createdAt: now,
            updatedAt: now,
            payload: form,
          }
          syncLocal([record, ...localRecords])
          setEditing({ kind: 'local', localId })
        }
        setNotice('Черновик сохранен локально.')
        return
      }

      if (editing?.kind === 'remote') {
        const response = await apiClient.put<{ item: ProtocolItem }>(
          `/protocols/drafts/${editing.id}`,
          formToPayload(form, sortByNet),
        )
        if (response.error || !response.data) {
          setError(response.error?.message ?? 'Ошибка сохранения черновика')
          return
        }
        setNotice('Черновик сохранен.')
      } else {
        const response = await apiClient.post<{ item: ProtocolItem }>(
          '/protocols/drafts',
          formToPayload(form, sortByNet),
        )
        if (response.error || !response.data) {
          setError(response.error?.message ?? 'Ошибка создания черновика')
          return
        }
        setEditing({ kind: 'remote', id: response.data.item.id })
        setNotice('Черновик создан.')
      }
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const printProtocol = async () => {
    const validation = validateFormDetailed(form)
    setFieldErrors(validation.fieldErrors)
    if (validation.message) {
      setError(validation.message)
      return
    }
    setBusy(true)
    setFieldErrors({})
    setError('')
    setNotice('')
    try {
      if (!isAdmin) {
        saveLocalDraftRecord(form)
        const response = await fetch(`${API_BASE_URL}/protocols/guest/form`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocol: formToPayload(form, sortByNet) }),
        })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          setError(payload?.error ?? 'Не удалось подготовить PDF Рє печати')
          return
        }
        const blob = await response.blob()
        openPdfBlob(blob)
        setNotice('Черновик сохранен локально. PDF открыт для печати.')
        return
      }

      let draftId = editing?.kind === 'remote' ? editing.id : null
      if (!draftId) {
        const createResponse = await apiClient.post<{ item: ProtocolItem }>(
          '/protocols/drafts',
          formToPayload(form, sortByNet),
        )
        if (createResponse.error || !createResponse.data) {
          setError(createResponse.error?.message ?? 'Не удалось создать черновик')
          return
        }
        draftId = createResponse.data.item.id
        setEditing({ kind: 'remote', id: draftId })
      } else {
        await apiClient.put(`/protocols/drafts/${draftId}`, formToPayload(form, sortByNet))
      }

      const response = await apiClient.post<{ item: ProtocolItem; downloadUrl: string }>(
        `/protocols/drafts/${draftId}/form`,
        {},
      )
      if (response.error || !response.data) {
        setError(response.error?.message ?? 'Не удалось подготовить PDF Рє печати')
        return
      }
      window.open(response.data.downloadUrl, '_blank', 'noopener,noreferrer')
      setNotice('Протокол сохранен и открыт для печати.')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const publishDraft = async () => {
    if (!isAdmin || editing?.kind !== 'remote') return
    setBusy(true)
    setError('')
    try {
      const response = await apiClient.post<{ item: ProtocolItem }>(
        `/protocols/drafts/${editing.id}/publish`,
        {},
      )
      if (response.error) {
        setError(response.error.message)
        return
      }
      setNotice('Протокол опубликован.')
      await reload()
      resetEditor()
    } finally {
      setBusy(false)
    }
  }

  const openRemote = (item: ProtocolItem) => {
    setEditing({ kind: 'remote', id: item.id })
    setForm(toForm(item))
    setSortByNet(item.sortByNetTime)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const openLocal = (item: LocalProtocolRecord) => {
    setEditing({ kind: 'local', localId: item.localId })
    setForm(item.payload)
    setSortByNet(item.sortByNetTime)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const removeDraft = async (id: string) => {
    if (!isAdmin) return
    const response = await apiClient.del<{ success: boolean }>(`/protocols/drafts/${id}`)
    if (response.error) {
      setError(response.error.message)
      return
    }
    setNotice('Черновик удален.')
    if (editing?.kind === 'remote' && editing.id === id) resetEditor()
    await reload()
  }


  const deletePublished = async (id: string) => {
    if (!isAdmin) return
    const response = await apiClient.del<{ success: boolean }>(`/protocols/published/${id}`)
    if (response.error) {
      setError(response.error.message)
      return
    }
    setNotice('Опубликованный протокол удален.')
    await fetchPublished()
  }

  const uploadPublishedProtocol = async () => {
    if (!isAdmin) return

    const validation = validateUploadForm(uploadForm)
    setUploadFieldErrors(validation.fieldErrors)
    if (validation.message) {
      setError(validation.message)
      return
    }

    const formData = new FormData()
    formData.append('title', uploadForm.title.trim())
    formData.append('formationDate', uploadForm.formationDate)
    formData.append('file', uploadForm.file as File)

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await apiClient.upload<{ item: ProtocolItem }>(
        '/protocols/published/upload',
        formData,
      )
      if (response.error) {
        setError(response.error.message)
        return
      }
      setUploadForm(emptyUploadForm())
      setUploadFieldErrors({})
      setShowUploadCard(false)
      setNotice('Файл протокола загружен Рё опубликован.')
      await fetchPublished()
    } finally {
      setBusy(false)
    }
  }

  const openProtocolEditor = () => {
    setShowUploadCard(false)
    setUploadFieldErrors({})
    setEditing({ kind: 'new' })
    setForm(emptyForm())
    setFieldErrors({})
    setTimeErrors({})
    setError('')
    setNotice('')
  }

  const openUploadEditor = () => {
    setEditing(null)
    setFieldErrors({})
    setTimeErrors({})
    setShowUploadCard(true)
    setUploadFieldErrors({})
    setError('')
    setNotice('')
  }

  const closeUploadEditor = () => {
    setShowUploadCard(false)
    setUploadFieldErrors({})
    setError('')
    setNotice('')
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Протоколы</h1>
        <div className={styles.headerActions}>
          <Button onClick={openProtocolEditor}>Создать протокол</Button>
          {isAdmin && (
            <Button variant="outline" onClick={openUploadEditor}>
              Загрузить протокол
            </Button>
          )}
        </div>
      </header>

      {!editing && error && <p className={styles.error}>{error}</p>}
      {!editing && notice && <p className={styles.notice}>{notice}</p>}

      {editing && (
        <section className={styles.editor}>
          <div className={styles.formGrid}>
            <label>
              Название
              <Input
                value={form.title}
                className={fieldErrors.title ? styles.inputInvalid : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  clearFieldError('title')
                  setForm((state) => ({ ...state, title: event.target.value }))
                }}
              />
            </label>
            <label>
              Дата
              <Input
                type="date"
                value={form.formationDate}
                className={fieldErrors.formationDate ? styles.inputInvalid : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  clearFieldError('formationDate')
                  setForm((state) => ({ ...state, formationDate: event.target.value }))
                }}
              />
            </label>
            <label>
              Интервал старта (сек.)
              <Input
                type="number"
                min={5}
                max={600}
                value={form.startIntervalSeconds}
                className={fieldErrors.startIntervalSeconds ? styles.inputInvalid : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  clearFieldError('startIntervalSeconds')
                  setForm((state) => ({
                    ...state,
                    startIntervalSeconds: Number(event.target.value) || 0,
                  }))
                }}
              />
            </label>
            <label>
              Главный судья
              <Input
                value={form.chiefJudgeName}
                className={fieldErrors.chiefJudgeName ? styles.inputInvalid : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  clearFieldError('chiefJudgeName')
                  setForm((state) => ({ ...state, chiefJudgeName: event.target.value }))
                }}
              />
            </label>
            <label>
              Секретарь
              <Input
                value={form.secretaryName}
                className={fieldErrors.secretaryName ? styles.inputInvalid : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  clearFieldError('secretaryName')
                  setForm((state) => ({ ...state, secretaryName: event.target.value }))
                }}
              />
            </label>
          </div>

          <div className={styles.tableActions}>
            <div className={styles.sortActions}>
              <Button
                variant="outline"
                size="compact"
                className={!sortByNet ? styles.sortButtonActive : undefined}
                onClick={() => {
                  setSortByNet(false)
                  applySortByNumber()
                }}
              >
                Сортировка по номеру
              </Button>
              <Button
                variant="outline"
                size="compact"
                className={sortByNet ? styles.sortButtonActive : undefined}
                onClick={() => {
                  setSortByNet(true)
                  applySortByNet()
                }}
              >
                Сортировка по чистому времени
              </Button>
            </div>
            <Button variant="outline" onClick={addLapColumn}>
              Добавить круг
            </Button>
            <Button variant="outline" onClick={removeLapColumn} disabled={laps === 0}>
              Удалить круг
            </Button>
            <Button variant="outline" onClick={addParticipant}>
              Добавить участника
            </Button>
            <Button variant="outline" onClick={applyStartInterval}>
              Заполнить старты по интервалу
            </Button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Фамилия</th>
                  <th>Старт</th>
                  {Array.from({ length: laps }, (_v, index) => (
                    <th key={`lap-${index + 1}`}>Круг {index + 1}</th>
                  ))}
                  <th>Финиш (грязное)</th>
                  <th>Чистое</th>
                  <th>DSQ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.participants.map((participant, index) => (
                  <tr key={`participant-${index}`}>
                    <td>
                      <Input
                        type="number"
                        min={1}
                        value={participant.number}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          clearFieldError(`participant-${index}-number`)
                          updateParticipantNumber(index, event.target.value)
                        }}
                        className={[
                          styles.numberInput,
                          fieldErrors[`participant-${index}-number`] ? styles.inputInvalid : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      />
                    </td>
                    <td>
                      <Input
                        value={participant.lastName}
                        className={
                          fieldErrors[`participant-${index}-lastName`]
                            ? styles.inputInvalid
                            : undefined
                        }
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          clearFieldError(`participant-${index}-lastName`)
                          updateParticipant(index, { lastName: event.target.value })
                        }}
                      />
                    </td>
                    <td>
                      <Input
                        placeholder="чч:мм:сс"
                        value={participant.startTime}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleTimeInputChange(index, event.target.value, 'startTime')
                        }
                        className={
                          timeErrors[getTimeErrorKey(index, 'startTime')] ||
                          fieldErrors[`participant-${index}-startTime`]
                            ? styles.inputInvalid
                            : undefined
                        }
                      />
                    </td>
                    {Array.from({ length: laps }, (_v, lapIndex) => (
                      <td key={`participant-${index}-lap-${lapIndex}`}>
                        <Input
                          placeholder="чч:мм:сс"
                          value={participant.lapTimes[lapIndex] ?? ''}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleTimeInputChange(index, event.target.value, 'lap', lapIndex)
                          }
                          className={
                            timeErrors[getTimeErrorKey(index, 'lap', lapIndex)]
                              ? styles.inputInvalid
                              : undefined
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <Input
                        placeholder="чч:мм:сс"
                        value={participant.finishTime}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleTimeInputChange(index, event.target.value, 'finishTime')
                        }
                        className={
                          timeErrors[getTimeErrorKey(index, 'finishTime')] ||
                          fieldErrors[`participant-${index}-finishTime`]
                            ? styles.inputInvalid
                            : undefined
                        }
                      />
                    </td>
                    <td>{participant.dsq ? 'DSQ' : formatSecToTime(computeNet(participant))}</td>
                    <td>
                      <Input
                        type="checkbox"
                        checked={participant.dsq}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateParticipant(index, { dsq: event.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="compact"
                        disabled={form.participants.length === 1}
                        onClick={() =>
                          setForm((state) => ({
                            ...state,
                            participants:
                              state.participants.length === 1
                                ? state.participants
                                : state.participants.filter((_v, rowIndex) => rowIndex !== index),
                          }))
                        }
                      >
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.formActions}>
            <Button onClick={() => void saveDraft()} disabled={busy}>
              Сохранить
            </Button>
            <Button onClick={() => void printProtocol()} disabled={busy}>
              Печать
            </Button>
            {isAdmin && editing?.kind === 'remote' && (
              <Button onClick={() => void publishDraft()} disabled={busy}>
                Опубликовать
              </Button>
            )}
            {isAdmin && editing?.kind === 'remote' && (
              <Button variant="danger" onClick={() => void removeDraft(editing.id)} disabled={busy}>
                Удалить черновик
              </Button>
            )}
            <Button variant="outline" onClick={resetEditor}>
              Закрыть
            </Button>
          </div>
          {(Object.values(timeErrors)[0] || error || notice) && (
            <div className={styles.formFeedback}>
              {Object.values(timeErrors)[0] && (
                <p className={styles.timeError}>{Object.values(timeErrors)[0]}</p>
              )}
              {error && error !== Object.values(timeErrors)[0] && (
                <p className={styles.error}>{error}</p>
              )}
              {notice && <p className={styles.notice}>{notice}</p>}
            </div>
          )}
        </section>
      )}

            {isAdmin && showUploadCard && (
        <section className={styles.section}>
          <div className={styles.uploadCard}>
            <div className={styles.formGrid}>
              <label>
                Название
                <Input
                  value={uploadForm.title}
                  className={uploadFieldErrors.title ? styles.inputInvalid : undefined}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    clearUploadFieldError('title')
                    setUploadForm((state) => ({ ...state, title: event.target.value }))
                  }}
                />
              </label>
              <label>
                Дата
                <Input
                  type="date"
                  value={uploadForm.formationDate}
                  className={uploadFieldErrors.formationDate ? styles.inputInvalid : undefined}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    clearUploadFieldError('formationDate')
                    setUploadForm((state) => ({ ...state, formationDate: event.target.value }))
                  }}
                />
              </label>
              <label>
                Файл DOC или Excel
                <Input
                  type="file"
                  accept=".doc,.docx,.xls,.xlsx"
                  className={uploadFieldErrors.file ? styles.inputInvalid : undefined}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    clearUploadFieldError('file')
                    const file = event.target.files?.[0] ?? null
                    setUploadForm((state) => ({ ...state, file }))
                  }}
                />
              </label>
            </div>
            <div className={styles.formActions}>
              <Button onClick={() => void uploadPublishedProtocol()} disabled={busy}>
                Загрузить готовый протокол
              </Button>
              <Button variant="outline" onClick={closeUploadEditor} disabled={busy}>
                Закрыть
              </Button>
            </div>
          </div>
        </section>
      )}
<section className={styles.section}>
        <div className={styles.sectionPanel}>
        <h2>Опубликованные протоколы</h2>
                {publishedSorted.length === 0 && (
          <p className={styles.muted}>Пока нет опубликованных протоколов.</p>
        )}
        {publishedSorted.map((item) => (
          <article key={item.id} className={styles.card}>
            <div>
              <a
                className={styles.publishedLink}
                href={`${API_BASE_URL}/protocols/published/${item.id}/download`}
                target="_blank"
                rel="noreferrer"
              >
                {item.title}
              </a>
              <p>{new Date(item.formationDate).toLocaleDateString('ru-RU')}</p>
              {item.pdfFileName && <p className={styles.muted}>{item.pdfFileName}</p>}
            </div>
            <div className={styles.cardActions}>
              {isAdmin && (
                <>
                  <Button
                    variant="danger"
                    size="compact"
                    onClick={() => void deletePublished(item.id)}
                  >
                    Удалить
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionPanel}>
        <h2>Черновики</h2>
        {isAdmin ? (
          <>
            {draftsSorted.length === 0 && <p className={styles.muted}>Черновики отсутствуют.</p>}
            {draftsSorted.map((item) => (
              <article key={item.id} className={styles.card}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{new Date(item.formationDate).toLocaleDateString('ru-RU')}</p>
                  <p>{item.status === 'FORMED' ? 'Сформирован' : 'Черновик'}</p>
                </div>
                <div className={styles.cardActions}>
                  <Button variant="outline" size="compact" onClick={() => openRemote(item)}>
                    Редактировать
                  </Button>
                  <Button variant="danger" size="compact" onClick={() => void removeDraft(item.id)}>
                    Удалить
                  </Button>
                </div>
              </article>
            ))}
          </>
        ) : (
          <>
            {localSorted.length === 0 && (
              <p className={styles.muted}>Локальные черновики отсутствуют.</p>
            )}
            {localSorted.map((item) => (
              <article key={item.localId} className={styles.card}>
                <div>
                  <strong>{item.payload.title || 'Без названия'}</strong>
                  <p>{new Date(item.payload.formationDate).toLocaleDateString('ru-RU')}</p>
                  <p>Черновик локально</p>
                </div>
                <div className={styles.cardActions}>
                  <Button variant="outline" size="compact" onClick={() => openLocal(item)}>
                    Редактировать
                  </Button>
                </div>
              </article>
            ))}
          </>
        )}
        </div>
      </section>
    </section>
  )
}

