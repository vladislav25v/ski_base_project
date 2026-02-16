import dotenv from 'dotenv'

dotenv.config()

const requireEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: requireEnv('JWT_SECRET', 'change-me'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001',
  storageDir: process.env.STORAGE_DIR ?? './storage',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@ski-base.local',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'change-me',
  s3Endpoint: process.env.S3_ENDPOINT ?? '',
  s3Region: process.env.S3_REGION ?? '',
  s3Bucket: process.env.S3_BUCKET ?? '',
  s3AccessKey: process.env.S3_ACCESS_KEY ?? '',
  s3SecretKey: process.env.S3_SECRET_KEY ?? '',
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  cookieDomain: process.env.COOKIE_DOMAIN ?? '',
}
