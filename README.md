# Ski Base Site

Волонтёрский сайт лыжной базы в городе Тында

Стек
фронтенд: React + RTK + Vite + SCSS
API: Express + Prisma + Postgres + S3

## Локальный запуск

Инфраструктура через докер. Схема создания контейнеров указана в `api/README.md`.

1. Установить зависимости:

npm i
cd api && npm i

2. Запуск:

# Docker контейнеры

docker start ski-pg
docker start ski-minio

# Миграции и seed

npm run prisma:migrate --prefix api
npm run prisma:seed --prefix api

# API (в одном терминале)

cd api
npm run dev

# фронт (в другом терминале)

cd ..
npm run dev
