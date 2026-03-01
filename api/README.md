# API (Express + Prisma)

## Создание Docker контейнеров (первый запуск)

PostgreSQL:

```bash
docker run --name ski-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ski -p 5432:5432 -d postgres:16
```

S3 (MinIO):

```bash
docker run --rm -e MC_HOST_local=http://minio:minio123@host.docker.internal:9000 minio/mc mb --ignore-existing local/dev-bucket
docker run --rm -e MC_HOST_local=http://minio:minio123@host.docker.internal:9000 minio/mc anonymous set download local/dev-bucket

```

Создать бакет `dev-bucket`:

```bash
docker run --rm -e MC_HOST_local=http://minio:minio123@host.docker.internal:9000 minio/mc mb --ignore-existing local/dev-bucket
```

После создания контейнеров используйте `docker start ski-pg` и `docker start ski-minio`.

## Локальный запуск

1. Установить зависимости:

```bash
npm i
```

2. Поднять бд и s3 в докере.

```bash
docker start ski-pg
docker start ski-minio
```

3. Применить миграции и сид:

```bash
npm run prisma:migrate
npm run prisma:seed
```

4. Запустить API:

```bash
npm run dev
```

## Локальный env (`api/.env`)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ski
PORT=3001
NODE_ENV=development

JWT_SECRET=dev-secret
PUBLIC_BASE_URL=http://localhost:3001
ADMIN_EMAIL=admin@local.dev

CORS_ORIGIN=http://localhost:5173
COOKIE_DOMAIN=
AUTH_SUCCESS_REDIRECT_URL=http://localhost:5173/admin
AUTH_ERROR_REDIRECT_URL=http://localhost:5173/admin

YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
YANDEX_REDIRECT_URI=http://localhost:3001/auth/yandex/callback

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=dev-bucket
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_PUBLIC_BASE_URL=http://localhost:9000/dev-bucket
```

## Endpoints

- `GET /auth/yandex/start`
- `GET /auth/yandex/callback`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/allowlist` (admin)
- `POST /auth/allowlist` (admin)
- `PATCH /auth/allowlist/:id` (admin)
- `GET /auth/security/stats` (admin)
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
