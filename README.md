# Ski Base Site

Волонтёрский сайт лыжной базы

Стек: фронтенд (React + Vite) и API (Express + Prisma + Postgres + S3).

## Быстрый локальный запуск

1. Установить зависимости:

```bash
npm i
cd api && npm i
```

2. Поднять локальную инфраструктуру (опционально, если не используете внешние сервисы):

```bash
docker run --name ski-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ski -p 5432:5432 -d postgres:16

docker run --name ski-minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio123 -d minio/minio server /data --console-address ":9001"
```

3. Настроить env:

- фронт: `/.env`
- API: `api/.env`

4. Применить миграции и (при необходимости) сид:

```bash
cd api
npm run prisma:migrate
npm run prisma:seed
```

5. Запуск:

```bash
# API
cd api
npm run dev

# фронт (в другом терминале)
cd ..
npm run dev
```

## Примечания

- `prisma:migrate` — обязательный шаг для схемы БД.
- `prisma:seed` — не удаляет новости/галерею/расписания, обновляет/создаёт админа.
- Для тренировок детей используется отдельная таблица и endpoint: `/training-schedule`.

## Прод (миграции после деплоя)

После выкладки новой версии кода:

```bash
cd /app/api
npm run prisma:migrate
```

Затем перезапустить API-процесс.
