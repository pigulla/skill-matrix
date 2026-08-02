# syntax=docker/dockerfile:1

# ---- build: compile TS, copy config + SQL into dist/ ----
FROM node:26-alpine AS build
WORKDIR /app
RUN apk add --no-cache rsync
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- prod-deps: production-only node_modules ----
FROM node:26-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: minimal non-root image ----
FROM node:26-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app

ENV NODE_ENV=production \
    NODE_OPTIONS="--conditions dist" \
    NODE_CONFIG_DIR=/app/dist/config \
    SERVER_HOSTNAME=0.0.0.0 \
    PATH=/app/node_modules/.bin:$PATH

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${SERVER_PORT:-3000}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["serve-with-migrate"]
