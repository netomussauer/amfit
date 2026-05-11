# syntax=docker/dockerfile:1.7

# Build do Next.js 14 com workspace pnpm. O contexto de build deve ser a
# raiz do monorepo (../../ a partir deste Dockerfile) para acessar
# packages/shared. Use:
#   docker build -f apps/web/Dockerfile -t harbor.infra.local/amfit/web:VER .

# Stage 1 — instala dependencias
# node:20-bookworm-slim (Debian) ja vem com tudo necessario, evita
# dependencia de dl-cdn.alpinelinux.org no build (egress restrito no lab).
FROM node:20-bookworm-slim AS deps

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /repo

# Manifests do workspace
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json        ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Sem --mount=type=cache (Kaniko nao suporta).
# Sem --frozen-lockfile porque pnpm-lock.yaml nao esta commitado no repo
# (pendente — gerar via `pnpm install` local quando houver pnpm dispo).
RUN pnpm install --filter @amfit/web... --filter @amfit/shared

# Stage 2 — build da aplicacao Next.js (output standalone)
FROM node:20-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /repo

COPY --from=deps /repo/node_modules                       ./node_modules
COPY --from=deps /repo/apps/web/node_modules              ./apps/web/node_modules
COPY --from=deps /repo/packages/shared/node_modules       ./packages/shared/node_modules

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web        ./apps/web
COPY packages/shared ./packages/shared

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @amfit/web build

# Stage 3 — runtime distroless
# - Sem package manager (evita apt/apk com egress restrito)
# - Inclui node 20
# - User nonroot ja pre-configurado (uid 65532)
FROM gcr.io/distroless/nodejs20-debian12:nonroot

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# A partir do output:'standalone', a pasta .next/standalone contem o
# server.js minimo. .next/static deve ser copiado a parte.
# public/ pode nao existir (Next.js cria por default mas pode estar vazio).
COPY --from=builder --chown=nonroot:nonroot /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /repo/apps/web/.next/static    ./apps/web/.next/static

USER nonroot:nonroot
EXPOSE 3000

CMD ["apps/web/server.js"]
