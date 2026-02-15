import { decode, encode } from 'blurhash'

const BLURHASH_WIDTH = 32
const BLURHASH_HEIGHT = 32

export const shuffleItems = <T,>(items: T[]) => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

export const getImageValidationError = (file: File) => {
  if (!file.type.startsWith('image/')) {
    return 'Файл не совпадает по формату: нужно изображение.'
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'Размер изображения не совпадает с лимитом 10 МБ.'
  }
  return ''
}

export const getImageMetadata = async (file: File) => {
  const bitmap = await createImageBitmap(file)
  const originalWidth = bitmap.width
  const originalHeight = bitmap.height
  const canvas = document.createElement('canvas')
  const targetWidth = 64
  const scale = targetWidth / originalWidth
  const targetHeight = Math.max(1, Math.round(originalHeight * scale))
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Не удалось подготовить изображение для blurhash.')
  }
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  const imageData = context.getImageData(0, 0, targetWidth, targetHeight)
  const hash = encode(imageData.data, targetWidth, targetHeight, 4, 4)
  bitmap.close()
  return {
    width: originalWidth,
    height: originalHeight,
    blurhash: hash,
  }
}

export const buildBlurDataUrl = (hash: string) => {
  try {
    const pixels = decode(hash, BLURHASH_WIDTH, BLURHASH_HEIGHT)
    const canvas = document.createElement('canvas')
    canvas.width = BLURHASH_WIDTH
    canvas.height = BLURHASH_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }
    const imageData = context.createImageData(BLURHASH_WIDTH, BLURHASH_HEIGHT)
    imageData.data.set(pixels)
    context.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
  } catch {
    return null
  }
}
