# AMFIT

Plataforma de gestão de treinos de musculação com dois perfis: **personal trainer** (portal web + app mobile) e **aluno** (app mobile).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Go 1.22 + Fiber v3 (arquitetura hexagonal) |
| Web Admin | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Mobile | Expo SDK 51 + React Native + TypeScript |
| Banco de dados | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Monorepo | pnpm Workspaces + Turborepo |
| Infra | K3s + ArgoCD + Tekton + Traefik + Harbor |

## Estrutura

```
amfit/
├── apps/
│   ├── api/          # Backend Go — bounded contexts, migrations, pkg/*
│   ├── web/          # Portal do personal trainer (Next.js)
│   └── mobile/       # App aluno + personal (Expo)
├── packages/
│   └── shared/       # @amfit/shared — schemas Zod, tipos, constantes
├── infra/
│   ├── k8s/          # Manifestos Kubernetes (API, web, MinIO)
│   └── argocd/       # Application CR (GitOps)
├── docs/
│   └── SDD.md        # Arquitetura completa, ERD, OpenAPI, roadmap
└── docker-compose.yml
```

## Pré-requisitos

- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/) + [pnpm 9+](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [OpenSSL](https://www.openssl.org/) (geração de chaves JWT)

## Setup local

### 1. Dependências

```bash
# JavaScript (web + mobile + shared)
pnpm install

# Go
cd apps/api && go mod tidy
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
# edite .env se necessário — defaults funcionam com o docker-compose
```

### 3. Chaves JWT (RS256)

```bash
cd apps/api
make keys
# gera apps/api/keys/private.pem e keys/public.pem
```

### 4. Serviços locais

```bash
# na raiz do projeto
docker compose up -d
```

Serviços disponíveis:

| Serviço | URL |
|---|---|
| PostgreSQL | `localhost:5432` — db `amfit`, user `amfit` |
| Redis | `localhost:6379` |
| MinIO API | `localhost:9000` |
| MinIO Console | `localhost:9001` |

### 5. Rodar

```bash
# API Go
cd apps/api && make dev
# → http://localhost:8080

# Web (Next.js)
cd apps/web && pnpm dev
# → http://localhost:3000

# Mobile (Expo)
cd apps/mobile && pnpm start
```

Verificar que a API está saudável:

```bash
curl http://localhost:8080/healthz
```

## Comandos úteis

```bash
# Turborepo — rodar tudo em paralelo
pnpm dev          # dev de todos os workspaces
pnpm build        # build de todos os workspaces
pnpm lint         # lint de todos os workspaces

# API Go (dentro de apps/api/)
make dev          # go run ./cmd/server
make build        # compila para bin/server
make test         # go test ./...
make lint         # golangci-lint run
make migrate-up   # aplica migrations pendentes
make migrate-down # reverte 1 migration
make keys         # gera par RS256 em keys/

# Docker Compose (raiz)
docker compose up -d      # sobe PG + Redis + MinIO
docker compose down       # para os serviços
docker compose down -v    # para e apaga volumes
```

## Migrations

As migrations ficam em `apps/api/migrations/` no formato `golang-migrate` (pares `.up.sql` / `.down.sql`).

São aplicadas automaticamente na inicialização da API. Para rodar manualmente:

```bash
cd apps/api
make migrate-up    # aplica todas as pendentes
make migrate-down  # reverte a última
```

## Deploy no lab (K3s)

O deploy é gerenciado pelo ArgoCD apontando para `infra/k8s/` na branch `main`.

```bash
# Aplicar o namespace e a Application do ArgoCD (apenas na primeira vez)
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/argocd/application.yaml

# Substituir o placeholder da chave JWT no Secret antes do apply
# infra/k8s/api/secret.yaml → jwt-private-key
```

Após o apply do ArgoCD, qualquer push para `main` sincroniza automaticamente.

**Ingresses (Traefik):**

| Serviço | URL |
|---|---|
| API | `https://api.amfit.local` |
| Web Admin | `https://app.amfit.local` |
| MinIO Console | `https://minio.amfit.local` |

> PostgreSQL e Redis consomem os serviços pré-existentes do namespace `shared-infra` — não há StatefulSets desses serviços neste repositório.

## Arquitetura

Ver [docs/SDD.md](docs/SDD.md) para:

- Decisões arquiteturais (ADRs)
- Mapa de bounded contexts (DDD)
- ERD completo
- Contratos OpenAPI 3.1
- Fluxos de navegação mobile
- Estratégia de real-time (WebSocket + SSE)
- Módulo financeiro (Asaas)
- Gamificação e Progressive Overload
- Roadmap de implementação (Fases 0–4)

## Roadmap

| Fase | Foco | Status |
|---|---|---|
| **0 — Fundação** | Monorepo, infra K8s, migrations, scaffolding | **Concluída** |
| **1 — MVP Core** | Auth, CRUD alunos/exercícios, montagem de fichas, app mobile funcional | Em andamento |
| **2 — Experiência** | Histórico, gráficos, medidas, notificações, Progressive Overload | — |
| **3 — Diferenciais** | White Label, Coach por vídeo, IA para fichas, financeiro | — |
| **4 — Expansão** | Wearables, modo offline, app personal completo | — |
