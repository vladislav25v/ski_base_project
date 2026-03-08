export type AuthUser = {
  id: string
  email: string
  role: string
}

export type NewsItem = {
  id: number
  createdAt: string
  updatedAt?: string
  title: string
  text: string
  imageUrl?: string | null
}

export type ScheduleDayRecord = {
  id: number
  day_of_week: number
  is_open: boolean
  start_time: string | null
  end_time: string | null
}

export type ScheduleDayUpsert = Omit<ScheduleDayRecord, 'id'>

export type ScheduleDay = {
  dayOfWeek: number
  label: string
  isOpen: boolean
  startTime: string
  endTime: string
}

export type ScheduleFormDay = ScheduleDay

export type TrainingSessionRecord = {
  id: number
  start_time: string
  end_time: string
}

export type TrainingSessionUpsert = Omit<TrainingSessionRecord, 'id'>

export type TrainingDayRecord = {
  id: number
  day_of_week: number
  is_open: boolean
  sessions: TrainingSessionRecord[]
}

export type TrainingDayUpsert = {
  day_of_week: number
  is_open: boolean
  sessions: TrainingSessionUpsert[]
}

export type GalleryPicture = {
  id: string
  createdAt: string
  storagePath: string
  caption?: string | null
  width?: number | null
  height?: number | null
  blurhash?: string | null
}

export type ProtocolStatus = 'DRAFT' | 'FORMED' | 'PUBLISHED'

export type ProtocolParticipant = {
  id?: string
  number: number
  sortOrder?: number
  lastName: string
  startTimeSec: number | null
  finishTimeSec: number | null
  netTimeSec: number | null
  dsq: boolean
  lapTimes: Array<number | null>
}

export type ProtocolItem = {
  id: string
  title: string
  formationDate: string
  startIntervalSeconds: number
  sortByNetTime: boolean
  chiefJudgeName: string | null
  secretaryName: string | null
  status: ProtocolStatus
  localSourceId: string | null
  formedAt: string | null
  publishedAt: string | null
  pdfStoragePath?: string | null
  pdfFileName?: string | null
  pdfPublicUrl?: string | null
  createdAt: string
  updatedAt: string
  participants: ProtocolParticipant[]
}
