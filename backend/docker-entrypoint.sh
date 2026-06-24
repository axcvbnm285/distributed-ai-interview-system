#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set."
  echo "Use docker compose so the backend gets the bundled Postgres connection automatically,"
  echo "or pass a database URL that is reachable from inside the container."
  exit 1
fi

retries="${PRISMA_MIGRATE_RETRIES:-20}"
delay="${PRISMA_MIGRATE_DELAY_SECONDS:-3}"
attempt=1

while [ "$attempt" -le "$retries" ]; do
  if npm run prisma:migrate:deploy; then
    exec npm start
  fi

  if [ "$attempt" -eq "$retries" ]; then
    echo "Prisma migrations failed after ${retries} attempts."
    exit 1
  fi

  echo "Database not reachable yet. Retrying in ${delay}s (${attempt}/${retries})..."
  attempt=$((attempt + 1))
  sleep "$delay"
done
