# syntax=docker/dockerfile:1.7

# Build do Next.js 14 com workspace pnpm. O contexto de build deve ser a
# raiz do monorepo (../../ a partir deste Dockerfile) para acessar
# packages/shared. Use:
#   docker build -f apps/web/Dockerfile -t harbor.infra.local/amfit/web:VER .
#
# Stage 1 — instala dependencias com cache de pnpm store
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /repo

# Manifests do workspace para cache layer
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY apps/web/package.json        ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --filter @amfit/web... --filter @amfit/shared

# Stage 2 — build da aplicacao Next.js (output standalone)
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /repo

COPY --from=deps /repo/node_modules                       ./node_modules
COPY --from=deps /repo/apps/web/node_modules              ./apps/web/node_modules
COPY --from=deps /repo/packages/shared/node_modules       ./packages/shared/node_modules

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY apps/web        ./apps/web
COPY packages/shared ./packages/shared

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @amfit/web build

# Stage 3 — runtime minimo (Next.js standalone server)
FROM node:20-alpine AS runner

RUN apk add --no-cache tzdata && \
    addgroup -g 1000 nodejs && \
    adduser  -u 1000 -G nodejs -D nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# A partir do output:'standalone', a pasta .next/standalone contem o
# server.js minimo. .next/static e public/ devem ser copiados a parte.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static    ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public          ./apps/web/public

USER nextjs:nodejs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
