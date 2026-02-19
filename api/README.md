# API (Express + Prisma)

## Создание Docker контейнеров (первый запуск)

PostgreSQL:

```bash
docker run --name ski-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ski -p 5432:5432 -d postgres:16
```

S3 (MinIO):

```bash
docker run --name ski-minio -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio123 -p 9000:9000 -p 9001:9001 -d minio/minio server /data --console-address ":9001"
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
ADMIN_PASSWORD=passwird

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
