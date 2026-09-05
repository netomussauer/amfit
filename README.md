# AMFIT

Plataforma de gestão de treinos de musculação com dois perfis: **personal trainer** (portal web + app mobile) e **aluno** (app mobile).

## Status

| Camada | Estado |
|---|---|
| Backend (5 bounded contexts) | ✅ Identity, Catalog, Training, Execution, Progress |
| Web admin (Next.js) | ✅ Personal: auth, alunos, exercícios, fichas, histórico, dashboard, evolução de carga, configurações de conta. ✅ Aluno (portal próprio, roteado por perfil): treino de hoje, execução de treino (com timer de descanso), histórico, progresso, perfil |
| Mobile (Expo) | ✅ Aluno (treino do dia, player, histórico, evolução de carga) + Personal (dashboard, exercícios) |
| Testes automatizados | ✅ Backend Go: todos os 5 contextos têm testes de application (Identity 59.2%, Catalog 65.3%, Training 46.8%, Execution 76.9%, Progress 17 testes). Frontend: só Progress (web Vitest+RTL 39 testes, mobile Jest+jest-expo+RTL 24 testes, lib compartilhada Vitest 12 testes) — demais features do web/mobile ainda sem teste |
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
pnpm test              # testes de todos os workspaces (web/mobile/shared)

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
| **2 — Experiência** | ~~Progressive Overload~~ ✅, ~~Anamnese inteligente~~ ✅, ~~gráficos de evolução~~ ✅, ~~notificações push~~ ✅, ~~compartilhamento social~~ ✅ | ✅ Concluída |
| **3 — Diferenciais** | ~~White Label~~ ✅, ~~Coach por vídeo~~ ✅ (sem chat/áudio ainda), IA para fichas (Claude API), ~~módulo financeiro~~ ✅ (cobrança manual — integração real com Asaas fica para uma próxima fatia) | Em andamento |
| **4 — Expansão** | Wearables (Apple Health + Google Health Connect), modo offline | — |

## Pendências de infra documentadas

Encontradas em 2026-09-01 ao investigar por que o fix de `/configuracoes`
não aparecia no lab mesmo já commitado. Já resolvidas (registro histórico
abaixo); nenhuma bloqueava o dia a dia, mas ambas custaram tempo real de
deploy:

- **Sem auto-trigger de CI/CD (causa raiz totalmente confirmada em
  2026-09-01, resolvida em 2026-09-04 — 3 causas encontradas e
  corrigidas)**: só existia 1 PipelineRun do AMFIT desde sempre (manual,
  de 11/05).
  Investigação via API do Gitea e teste direto no EventListener encontrou
  três causas empilhadas:
  1. O repo `labadmin/amfit` no Gitea nunca teve nenhum webhook configurado
     (`GET /repos/labadmin/amfit/hooks` retornava `[]`) — criado, apontando
     pro `el-amfit-event-listener` correto, com o Secret
     `gitea-webhook-secret` (que também não existia) criado no namespace
     `cicd` pra bater com o `secretRef` que o Trigger `amfit-gitea-push` já
     esperava.
  2. **Mesmo com o webhook criado, o Trigger em si estava quebrado**: o
     interceptor `ref: {name: gitea}` referenciava um ClusterInterceptor
     que não existe neste cluster (`kubectl get clusterinterceptor` só
     lista `cel`, `github`, `gitlab`, `bitbucket`, `slack`) — toda chamada
     de webhook falharia aí, mesmo com webhook e secret corretos. Corrigido
     em `infra/tekton/trigger-amfit.yaml`: validação só via CEL, mesma
     solução já usada (e documentada) no REALTPMSYS.
  3. **A causa de fundo, resolvida em 2026-09-04**: o mirror Gitea
     (`labadmin/amfit.git`) só fazia *pull* periódico do GitHub, e esse
     tipo de sincronização não passa pelo mesmo code path de um `git push`
     real — não disparava webhook nenhum. Testado e confirmado isso na
     prática no REALTPMSYS antes da correção: um POST sintético do
     formato exato que o Gitea manda, direto no EventListener, criou um
     PipelineRun genuíno (`trigger: gitea-push`, não `manual`) que rodou
     build+push com sucesso — a cadeia toda funciona quando recebe um
     evento de push de verdade. Resolvido invertendo a direção do mirror:
     o repo Gitea foi convertido de mirror (pull) para repositório
     regular com um *push mirror* configurado pro GitHub — o Gitea agora
     é o remoto primário (`origin`) e o GitHub é sincronizado
     automaticamente a cada push.
- [x] **Mesmo com o webhook disparando de verdade, os builds nunca chegavam
  a rodar/deployar (encontrado e resolvido em 2026-09-04, mesma
  investigação de "por que a Anamnese não aparecia no lab" mesmo já
  commitada)**: três causas empilhadas, cada uma escondendo a próxima.
  1. **`ROOT_URL` do Gitea sem porta**: `helm-values.yaml` tinha
     `ROOT_URL: "http://gitea.lab.local"` (sem `:3000`, o `HTTP_PORT`
     real). Gitea usa esse valor pra montar qualquer URL absoluta que
     emite, inclusive o `clone_url` do payload do webhook — todo build
     disparado por webhook tentava `git clone` na porta 80, onde não
     existe Ingress nenhum, e falhava no passo de clone
     ("Could not connect to server"). Os PipelineRuns manuais nunca
     pegavam esse bug porque já hardcodavam a URL certa como workaround
     pontual. Corrigido em
     `infra-lab/kubernetes/cicd/gitea/helm-values.yaml` (`ROOT_URL` agora
     inclui a porta) + `helm upgrade` pinado na versão já rodando
     (12.5.3 — nunca fazer upgrade sem `--version` explícito aqui, ver
     nota abaixo).
  2. **Kaniko no mesmo node/disco do Postgres do Harbor**: o build da API
     não tinha `nodeSelector` fixo (`workload: cicd`, que só existe em
     `k3s-worker-cicd`) — o mesmo node onde TODO o storage `local-path`
     do Harbor mora (database/registry/trivy/redis). O I/O pesado do
     kaniko extraindo camadas de imagem no mesmo disco derrubava o
     Postgres em crash-loop (`fsync` de 12–20s durante recovery,
     "untracked child process exited with exit code 141" repetido) toda
     vez que um build tentava rodar — sem tocar `DiskPressure` do
     kubelet, que só olha espaço livre, não latência de I/O. Corrigido
     movendo o build da API pra `ubuntu-neto` (mesmo node que o build do
     Web já usava, por outro motivo — memória), tanto no PipelineRun
     manual quanto no `TriggerTemplate` do webhook, em
     `infra/tekton/pipelinerun-api-manual.yaml` e
     `infra/tekton/trigger-amfit.yaml` (que também corrigido pro build do
     Web — estava com `workload: cicd` inconsistente com o manual).
  3. **CA do Harbor rotacionado sem re-trust nos nodes**: o certificado
     TLS do Harbor foi reemitido em 02/09 (novo `harbor-ca`), mas o
     trust store de cada node do K3s (instalado manualmente via
     `infra-lab/ansible/playbooks/07-k3s-registries.yml` — containerd
     nessa versão do K3s não lê `certs.d/`, só o trust store do SO)
     ficou com a cópia antiga. Todo `image pull` novo (não só do AMFIT)
     falhava com `x509: certificate signed by unknown authority`, mesmo
     com o build+push funcionando — os pods antigos continuavam rodando
     porque nunca precisaram re-pullar. Corrigido re-rodando o playbook
     (reinstala o CA atual do secret `harbor-nginx` em todos os nodes,
     reinicia k3s-server/k3s-agent pra recarregar o trust store).
  4. **A mais traiçoeira: `infra/tekton/trigger-amfit.yaml` usava
     `resourceTemplates` (camelCase) — o campo real da API do Tekton
     Triggers v1beta1 é `resourcetemplates` (tudo minúsculo)**. Campo
     desconhecido é descartado silenciosamente pelo apiserver antes de
     gravar; `kubectl apply` reportava "configured" e a annotation
     `last-applied-configuration` acumulava fielmente cada correção
     commitada, mas o `spec.resourcetemplates` de verdade nunca mudava —
     o objeto ficou preso no estado de quando foi criado (08/05), com
     `harbor.infra.local` (já corrigido em git desde 11/05!) e
     `nodeSelector: workload:cicd` (o item 2 acima, que eu tinha certeza
     de ter corrigido no mesmo `kubectl apply` de hoje, mas nunca
     chegou no objeto real). Builds manuais nunca pegavam esse bug
     porque usam PipelineRuns standalone, sem passar pelo
     TriggerTemplate. Só descoberto comparando contra o TriggerTemplate
     do REALTPMSYS (que usa a grafia certa e funciona) depois que um
     push real continuou falhando mesmo com o arquivo aparentemente
     corrigido. Corrigido trocando a chave; validado comparando
     `spec.resourcetemplates` do objeto ao vivo contra o arquivo antes
     de seguir.
- [x] **Limite de memória do kaniko-build-push era baixo para builds
  Node** (resolvido em 2026-09-02): a Task compartilhada
  `kaniko-build-push` (namespace `cicd`) tinha `limits.memory: 1Gi`,
  suficiente para o build Go da API mas insuficiente para o build Next.js
  do Web (OOMKilled, exit 137, durante `next build`). O deploy de
  2026-09-01 contornou isso com um override pontual (`taskRunSpecs` no
  PipelineRun, 2.5Gi) sem alterar a Task compartilhada; o valor 2.5Gi foi
  então promovido a default da Task em si
  (`infra-lab/kubernetes/cicd/tekton/pipeline-build-push.yaml`), então
  novos PipelineRuns de qualquer app Next.js/Node (incluindo REALTPMSYS)
  não precisam mais descobrir isso de novo.

Histórico da entrega inicial (DNS interno, CA do Harbor, `imagePullSecrets`,
CoreDNS pinned, bugs de musl/getaddrinfo e egress do `k3s-worker-cicd`) segue
arquivado — esses itens estão resolvidos:

- [`infra/cluster/archive/PENDING.md`](infra/cluster/archive/PENDING.md)
- [`infra/cluster/archive/LAB-BUGS.md`](infra/cluster/archive/LAB-BUGS.md)
