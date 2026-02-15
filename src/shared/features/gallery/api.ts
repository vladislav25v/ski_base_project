import { supabase } from '../../lib'
import type { GalleryPicture } from '../../model'

export type GalleryItem = GalleryPicture & {
  publicUrl: string
}

const IMAGE_BUCKET = 'news_images'

export const getGalleryPublicUrl = (path: string) =>
  supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl

export const fetchGalleryPictures = async () => {
  const { data, error } = await supabase
    .from('gallery_pictures')
    .select('id, created_at, storage_path, caption, width, height, blurhash')
    .order('created_at', { ascending: false })

  if (error) {
    return { items: [], error }
  }

  const items: GalleryItem[] =
    data?.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      storagePath: item.storage_path,
      caption: item.caption,
      width: item.width,
      height: item.height,
      blurhash: item.blurhash,
      publicUrl: getGalleryPublicUrl(item.storage_path),
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
  return supabase.functions.invoke('gallery-upload', { body: formData })
}

export const deleteGalleryPicture = async (id: string) =>
  supabase.functions.invoke('gallery-delete', { body: { id } })
