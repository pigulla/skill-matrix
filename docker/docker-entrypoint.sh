#!/bin/sh
set -eu

urlencode() {
  # percent-encode $1 for use in a URL
  printf '%s' "$1" | sed -e 's/%/%25/g' \
    -e 's/@/%40/g' -e 's/:/%3A/g' \
    -e 's#/#%2F#g' -e 's/?/%3F/g' \
    -e 's/#/%23/g'
}

run_migrations() {
  : "${DATABASE_HOST:?DATABASE_HOST is required}"
  : "${DATABASE_USERNAME:?DATABASE_USERNAME is required}"
  : "${DATABASE_PASSWORD:?DATABASE_PASSWORD is required}"
  DATABASE_PORT="${DATABASE_PORT:-5432}"
  DATABASE_NAME="${DATABASE_NAME:-skillmatrix}"

  user_enc=$(urlencode "$DATABASE_USERNAME")
  pass_enc=$(urlencode "$DATABASE_PASSWORD")
  url="postgres://${user_enc}:${pass_enc}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}"

  DATABASE_SSL="${DATABASE_SSL:-true}"

  if [ -n "${DATABASE_SSLMODE:-}" ]; then
    url="${url}?sslmode=${DATABASE_SSLMODE}"
  elif [ "$DATABASE_SSL" = "false" ]; then
    url="${url}?sslmode=disable"
  else
    url="${url}?sslmode=require"
  fi

  echo "Running database migrations..."
  DATABASE_URL="$url" node-pg-migrate up \
    -m dist/migrations -t pgmigrations --migration-file-language sql
}

start_app() {
  echo "Starting application..."
  exec node dist/src/index.js
}

case "${1:-serve-with-migrate}" in
  migrate)            run_migrations ;;
  serve)              start_app ;;
  serve-with-migrate) run_migrations; start_app ;;
  *)                  exec "$@" ;;
esac
