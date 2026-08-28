# AMFIT

Plataforma de gestão de treinos de musculação com dois perfis: **personal trainer** (portal web + app mobile) e **aluno** (app mobile).

## Status

| Camada | Estado |
|---|---|
| Backend (5 bounded contexts) | ✅ Identity, Catalog, Training, Execution, Progress |
| Web admin (Next.js) | ✅ Auth, alunos, exercícios, fichas, histórico, dashboard, evolução de carga |
| Mobile (Expo) | ✅ Aluno (treino do dia, player, histórico, evolução de carga) + Personal (dashboard, exercícios) |
| Build CI (Tekton) | ✅ Pipelines API + Web ativos (`golang-test` reativado: `go vet` + `go test -race`) |
| Deploy GitOps (ArgoCD) | ✅ Application Healthy em produção (lab K3s) |

**Endpoints em produção (lab):**

| Serviço | URL externa | URL interna |
|---|---|---|
| API | <http://api.amfit.local:8080> | 192.168.1.205:8080 |
| Web | <http://app.amfit.local:3000> | 192.168.1.206:3000 |
| MinIO | <http://minio.amfit.local:9000> (API) / :9001 (console) | 192.168.1.207 |

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Go 1.22 + Fiber v3 (arquitetura hexagonal) |
| Web admin | Next.js 14 (App Router) + Tailwind CSS + TanStack Query |
| Mobile | Expo SDK 51 + React Native + TypeScript + NativeWind |
| Banco de dados | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible, bucket público para mídias de exercícios) |
| Monorepo | pnpm Workspaces + Turborepo |
| Imagens | Distroless multi-stage (`gcr.io/distroless/{static,nodejs20}-debian12:nonroot`) |
| Registry | Harbor (`harbor.lab.local`) |
| Pipelines | Tekton (`amfit-build-api` + `amfit-build-web`) com Kaniko |
| GitOps | ArgoCD (path `infra/k8s/`) |
| Exposição | MetalLB LoadBalancer (sem IngressController) |
| DNS interno | Pi-hole (`*.lab.local`, `*.infra.local`, `*.amfit.local`) |

## Estrutura

```
amfit/
├── apps/
│   ├── api/                # Backend Go — bounded contexts, migrations, pkg/*, Dockerfile distroless
│   ├── web/                # Portal personal trainer (Next.js 14, output: standalone)
│   └── mobile/             # App aluno + personal (Expo)
├── packages/
│   └── shared/             # @amfit/shared — schemas Zod, tipos, constantes
├── infra/
│   ├── k8s/                # Manifestos K8s (namespace, api, web, minio) — sincronizado por ArgoCD
│   ├── argocd/             # Application CR
│   ├── tekton/             # Pipelines + Triggers + ServiceAccount + RBAC + PipelineRuns manuais
│   └── cluster/            # ConfigMaps de cluster (coredns-custom) + LAB-BUGS.md + PENDING.md
├── docs/
│   └── SDD.md              # Arquitetura completa: ADRs, ERD, OpenAPI, fluxos, roadmap
├── docker-compose.yml      # PostgreSQL + Redis + MinIO para dev local
└── .env.example
```

## Pré-requisitos

- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/) + [pnpm 9+](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [OpenSSL](https://www.openssl.org/) (geração de chaves JWT)

## Setup local

```bash
# 1. Dependências
pnpm install
cd apps/api && go mod tidy && cd ../..

# 2. Variáveis de ambiente
cp .env.example .env

# 3. Chaves JWT RS256
cd apps/api && make keys && cd ../..

# 4. PostgreSQL + Redis + MinIO via Docker
docker compose up -d

# 5. Rodar (em terminais separados)
cd apps/api    && make dev      # → http://localhost:8080
cd apps/web    && pnpm dev      # → http://localhost:3000
cd apps/mobile && pnpm start    # → Expo

# 6. Smoke test
curl http://localhost:8080/healthz   # {"status":"ok"}
```

## Comandos úteis

```bash
# Turborepo (raiz do monorepo)
pnpm dev               # dev de todos os workspaces em paralelo
pnpm build             # build de todos
pnpm lint              # lint de todos

# API Go (dentro de apps/api/)
make dev               # go run ./cmd/server
make build             # binário em bin/server
make test              # go test -race ./...
make migrate-up        # aplica migrations pendentes
make migrate-create NAME=add_xxx
make keys              # gera par RS256 em keys/

# Docker Compose (raiz)
docker compose up -d
docker compose down -v
```

## Build de imagens (Tekton no cluster)

Tekton pipelines em `infra/tekton/` constroem as imagens via Kaniko e publicam em Harbor sem necessidade de Docker local.

```bash
# Setup inicial (uma vez)
kubectl apply -k infra/tekton/

# Secrets reais (FORA do Git — ver infra/tekton/secret-template.yaml)
kubectl create secret docker-registry harbor-creds ... -n cicd
kubectl create secret generic gitea-webhook-secret ... -n cicd

# Build manual de cada imagem
kubectl create -f infra/tekton/pipelinerun-api-manual.yaml -n cicd
kubectl create -f infra/tekton/pipelinerun-web-manual.yaml -n cicd

# Logs
tkn pipelinerun logs --last -f -n cicd
```

A imagem do **Web** é buildada no nó `ubuntu-neto` (8Gi) por causa do `pnpm install` pesado — o nodeSelector está no PipelineRun. API é leve, qualquer nó com label `workload=cicd` serve.

Ver [`infra/tekton/README.md`](infra/tekton/README.md) para operação detalhada e config do webhook do Gitea.

## Deploy no lab (ArgoCD GitOps)

```bash
# Primeira vez:
kubectl apply -f infra/argocd/application.yaml

# Estado:
kubectl get application amfit -n cicd
kubectl get pods -n amfit

# Smoke tests:
curl http://192.168.1.205:8080/healthz                # API
curl -o /dev/null -w "%{http_code}\n" http://192.168.1.206:3000/   # Web
```

ArgoCD aponta para `infra/k8s/` na branch `main` (via Gitea mirror em `gitea.lab.local/labadmin/amfit.git`). Qualquer push pra `main` que toque manifestos K8s é sincronizado automaticamente (`selfHeal: true`).

**PostgreSQL e Redis vêm do namespace `shared-infra` pré-existente.** O AMFIT só deploya API, Web e MinIO. PostgreSQL/Redis são consumidos via DNS interno do cluster.

### Secret de pull do Harbor

Harbor exige autenticação. O Secret `harbor-pull-secret` é criado uma vez no namespace `amfit` clonando `harbor-creds` de `cicd` (mesma credencial do robot account Tekton):

```bash
kubectl get secret harbor-creds -n cicd -o yaml \
  | sed 's/namespace: cicd/namespace: amfit/; s/name: harbor-creds/name: harbor-pull-secret/' \
  | sed '/resourceVersion:\|uid:\|creationTimestamp:/d' \
  | kubectl apply -f -
```

Os Deployments `amfit-api` e `amfit-web` referenciam esse secret via `imagePullSecrets`.

## Arquitetura

Ver [`docs/SDD.md`](docs/SDD.md) para:

- Decisões arquiteturais (ADRs)
- Mapa de bounded contexts (DDD): Identity, Catalog, Training, Execution, Progress, Notification, Chat, Gamification, Financial
- ERD completo
- Contratos OpenAPI 3.1
- Fluxos de navegação mobile e fluxo do player de treino
- Estratégia de real-time (WebSocket + SSE)
- Módulo financeiro (Asaas)
- Gamificação + Progressive Overload Automático
- Funcionalidades diferenciais (White Label, Coach por vídeo, IA, Wearables)
- Roadmap completo

## Roadmap

| Fase | Foco | Status |
|---|---|---|
| **0 — Fundação** | Monorepo, infra K8s, migrations, scaffolding | ✅ Concluída |
| **1 — MVP Core** | Auth, CRUD alunos/exercícios, fichas, app mobile funcional, execução de treino, histórico | ✅ Concluída (4 fatias: Identity, Catalog, Training, Execution) |
| **2 — Experiência** | Progressive Overload, Anamnese inteligente, ~~gráficos de evolução~~ ✅, notificações push, compartilhamento social | Em andamento |
| **3 — Diferenciais** | White Label, Coach por vídeo, IA para fichas (Claude API), módulo financeiro (Asaas) | — |
| **4 — Expansão** | Wearables (Apple Health + Google Health Connect), modo offline | — |

## Pendências de infra documentadas

Nenhuma pendência de infra aberta hoje (verificado em 2026-08-28). O histórico
de troubleshooting da entrega inicial (DNS interno, CA do Harbor,
`imagePullSecrets`, CoreDNS pinned, bugs de musl/getaddrinfo e egress do
`k3s-worker-cicd`) foi arquivado — todos os itens estão resolvidos:

- [`infra/cluster/archive/PENDING.md`](infra/cluster/archive/PENDING.md)
- [`infra/cluster/archive/LAB-BUGS.md`](infra/cluster/archive/LAB-BUGS.md)
