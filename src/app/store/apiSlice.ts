import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getMediaPublicUrl } from '../../shared/lib/apiClient'
import type {
  AuthUser,
  GalleryPicture,
  NewsItem,
  ScheduleDayRecord,
  ScheduleDayUpsert,
  TrainingDayRecord,
  TrainingDayUpsert,
} from '../../shared/model'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export type GalleryItem = GalleryPicture & {
  publicUrl: string
}

export type GalleryUploadMeta = {
  width: number
  height: number
  blurhash: string
  caption?: string | null
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['Auth', 'News', 'Gallery', 'Schedule', 'TrainingSchedule'],
  endpoints: (builder) => ({
    getMe: builder.query<AuthUser | null, void>({
      query: () => '/auth/me',
      transformResponse: (response: { user: AuthUser }) => response.user,
      providesTags: ['Auth'],
    }),
    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['Auth'],
    }),
    getNews: builder.query<NewsItem[], { limit?: number } | void>({
      query: (arg) => ({
        url: '/news',
        params: arg?.limit ? { limit: String(arg.limit) } : undefined,
      }),
      transformResponse: (response: { items: NewsItem[] }) => response.items ?? [],
      providesTags: ['News'],
    }),
    upsertNews: builder.mutation<NewsItem, FormData>({
      query: (body) => ({
        url: '/news',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { item: NewsItem }) => response.item,
      invalidatesTags: ['News'],
    }),
    deleteNews: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `/news/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['News'],
    }),
    getGallery: builder.query<GalleryItem[], void>({
      query: () => '/gallery',
      transformResponse: (
        response: { items: Array<GalleryPicture & { publicUrl?: string }> },
      ) =>
        (response.items ?? []).map((item) => ({
          ...item,
          publicUrl: item.publicUrl || getMediaPublicUrl(item.storagePath),
        })),
      providesTags: ['Gallery'],
    }),
    uploadGallery: builder.mutation<GalleryItem[], { files: File[]; meta: GalleryUploadMeta[] }>({
      query: ({ files, meta }) => {
        const formData = new FormData()
        files.forEach((file) => formData.append('files', file))
        formData.append('meta', JSON.stringify(meta))
        return {
          url: '/gallery',
          method: 'POST',
          body: formData,
        }
      },
      transformResponse: (response: { items: GalleryPicture[] }) =>
        (response.items ?? []).map((item) => ({
          ...item,
          publicUrl: getMediaPublicUrl(item.storagePath),
        })),
      invalidatesTags: ['Gallery'],
    }),
    deleteGalleryPicture: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/gallery/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Gallery'],
    }),
    getSchedule: builder.query<ScheduleDayRecord[], '/schedule' | '/training-schedule'>({
      query: (path) => path,
      transformResponse: (response: { items: ScheduleDayRecord[] }) => response.items ?? [],
      providesTags: ['Schedule'],
    }),
    updateSchedule: builder.mutation<{ success: boolean }, { path: '/schedule' | '/training-schedule'; days: ScheduleDayUpsert[] }>({
      query: ({ path, days }) => ({
        url: path,
        method: 'PUT',
        body: { days },
      }),
      invalidatesTags: ['Schedule'],
    }),
    getTrainingSchedule: builder.query<TrainingDayRecord[], void>({
      query: () => '/training-schedule',
      transformResponse: (response: { items: TrainingDayRecord[] }) => response.items ?? [],
      providesTags: ['TrainingSchedule'],
    }),
    updateTrainingSchedule: builder.mutation<{ success: boolean }, { days: TrainingDayUpsert[] }>({
      query: ({ days }) => ({
        url: '/training-schedule',
        method: 'PUT',
        body: { days },
      }),
      invalidatesTags: ['TrainingSchedule'],
    }),
  }),
})

export const {
  useGetMeQuery,
  useLogoutMutation,
  useGetNewsQuery,
  useUpsertNewsMutation,
  useDeleteNewsMutation,
  useGetGalleryQuery,
  useUploadGalleryMutation,
  useDeleteGalleryPictureMutation,
  useGetScheduleQuery,
  useUpdateScheduleMutation,
  useGetTrainingScheduleQuery,
  useUpdateTrainingScheduleMutation,
} = apiSlice
