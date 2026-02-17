# API (Express + Prisma)

## Основные команды

```bash
npm run dev
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Локальный env (`api/.env`)

Минимально:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ski
PORT=3001
NODE_ENV=development

JWT_SECRET=dev-secret
PUBLIC_BASE_URL=http://localhost:3001
ADMIN_EMAIL=admin@local.dev
ADMIN_PASSWORD=change-me

CORS_ORIGIN=http://localhost:5173
COOKIE_DOMAIN=

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=4804453a-1c0f-495d-ba30-ae2d14457195
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_PUBLIC_BASE_URL=http://localhost:9000/4804453a-1c0f-495d-ba30-ae2d14457195
```

## Endpoints

- `POST /auth/login`
- `POST /auth/logout`
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

## Важно

- Для прода используйте отдельный сильный `JWT_SECRET`.
- После деплоя с новыми миграциями обязательно запускать `npm run prisma:migrate`.
