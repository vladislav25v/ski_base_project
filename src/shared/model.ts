export type AuthCredentials = {
  email: string
  password: string
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

export type GalleryPicture = {
  id: string
  createdAt: string
  storagePath: string
  caption?: string | null
  width?: number | null
  height?: number | null
  blurhash?: string | null
}
