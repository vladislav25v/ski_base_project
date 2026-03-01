export type AuthUser = {
  id: string
  email: string
  role: string
}

export type NewsItem = {
  id: number
  createdAt: string
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
