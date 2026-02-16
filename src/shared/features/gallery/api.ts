import { apiClient, getMediaPublicUrl } from '../../lib'
import type { GalleryPicture } from '../../model'

export type GalleryItem = GalleryPicture & {
  publicUrl: string
}

export const getGalleryPublicUrl = (path: string) => getMediaPublicUrl(path)

export const fetchGalleryPictures = async () => {
  const { data, error } = await apiClient.get<{
    items: Array<
      GalleryPicture & {
        publicUrl?: string
      }
    >
  }>('/gallery')

  if (error) {
    return { items: [], error }
  }

  const items: GalleryItem[] =
    data?.items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      storagePath: item.storagePath,
      caption: item.caption,
      width: item.width,
      height: item.height,
      blurhash: item.blurhash,
      publicUrl: item.publicUrl || getGalleryPublicUrl(item.storagePath),
    })) ?? []

  return { items, error: null }
}

export type GalleryUploadMeta = {
  width: number
  height: number
  blurhash: string
  caption?: string | null
}

export const uploadGalleryPictures = async (files: File[], meta: GalleryUploadMeta[]) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  formData.append('meta', JSON.stringify(meta))
  return apiClient.upload('/gallery', formData)
}

export const deleteGalleryPicture = async (id: string) =>
  apiClient.del(`/gallery/${id}`)
