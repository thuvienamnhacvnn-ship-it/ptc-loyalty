# syntax=docker/dockerfile:1

# PTC-BONUS production image.
#
# Multi-stage: deps → build → runtime. The runtime stage carries only the Next
# standalone server, the static assets and the Prisma engines — no source, no
# dev dependencies, ~200 MB instead of ~1.5 GB.

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` statically evaluates a few pages, so the build needs values for
# the env vars those pages read. They are placeholders: every real secret is
# injected at RUN time by docker-compose, never baked into the image.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    QR_SIGNING_SECRET="build-time-placeholder-not-used-at-runtime"

# NEXT_PUBLIC_* IS inlined into the client bundle, so it must be the real value.
ARG NEXT_PUBLIC_APP_URL="https://ptc-bonus.com"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npx prisma generate && npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as the unprivileged user that ships with the node image.
RUN mkdir -p /app && chown -R node:node /app

# Standalone server + assets.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Prisma schema + CLI so the entrypoint can apply migrations, and the seed.
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node docker/app-entrypoint.sh /usr/local/bin/app-entrypoint.sh
RUN chmod +x /usr/local/bin/app-entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/app-entrypoint.sh"]
CMD ["node", "server.js"]
