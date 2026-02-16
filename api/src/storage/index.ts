import { randomUUID } from 'crypto'
import path from 'path'
import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/env'

const ensureS3Config = () => {
  if (!env.s3Endpoint || !env.s3Region || !env.s3Bucket || !env.s3AccessKey || !env.s3SecretKey) {
    throw new Error('S3 is not configured')
  }
}

const s3Client = () => {
  ensureS3Config()
  return new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint,
    credentials: {
      accessKeyId: env.s3AccessKey,
      secretAccessKey: env.s3SecretKey,
    },
    forcePathStyle: true,
  })
}

const getPublicBaseUrl = () => {
  if (env.s3PublicBaseUrl) {
    return env.s3PublicBaseUrl.replace(/\/$/, '')
  }
  const endpoint = env.s3Endpoint.replace(/\/$/, '')
  return `${endpoint}/${env.s3Bucket}`
}

export const buildPublicUrl = (key: string) => {
  const base = getPublicBaseUrl()
  return `${base}/${key.replace(/^\/+/, '')}`
}

export const getStoragePathFromUrl = (url: string) => {
  const base = getPublicBaseUrl()
  if (!url.startsWith(base)) {
    return null
  }
  return decodeURIComponent(url.slice(base.length + 1))
}

const getExtension = (filename: string, mimeType: string) => {
  const fromName = path.extname(filename)
  if (fromName) {
    return fromName
  }
  if (mimeType === 'image/png') {
    return '.png'
  }
  if (mimeType === 'image/webp') {
    return '.webp'
  }
  if (mimeType === 'image/gif') {
    return '.gif'
  }
  return '.jpg'
}

export const uploadImage = async (prefix: string, file: Express.Multer.File) => {
  const client = s3Client()
  const extension = getExtension(file.originalname, file.mimetype)
  const key = `${prefix}/${randomUUID()}${extension}`

  await client.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
      ACL: 'public-read',
    }),
  )

  return {
    key,
    publicUrl: buildPublicUrl(key),
  }
}

export const removeFileSafe = async (key: string | null) => {
  if (!key) {
    return
  }
  try {
    const client = s3Client()
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
      }),
    )
  } catch {
    // Ignore delete errors.
  }
}
