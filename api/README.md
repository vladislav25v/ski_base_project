# Ski Base API

## Env

`api/.env` expects:

- `DATABASE_URL`
- `JWT_SECRET`
- `PUBLIC_BASE_URL`
- `STORAGE_DIR`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_PUBLIC_BASE_URL`
- `CORS_ORIGIN`
- `COOKIE_DOMAIN`

## Scripts

- `npm run dev`
- `npm run prisma:migrate`
- `npm run prisma:seed`

## Endpoints

- `POST /auth/login`
- `GET /auth/me`
- `GET /news`
- `POST /news` (admin)
- `DELETE /news/:id` (admin)
- `GET /gallery`
- `POST /gallery` (admin)
- `DELETE /gallery/:id` (admin)
- `GET /schedule`
- `PUT /schedule` (admin)
- `GET /training-schedule`
- `PUT /training-schedule` (admin)
