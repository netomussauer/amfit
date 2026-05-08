# Tekton — AMFIT CI

Pipelines Tekton para build e push das imagens AMFIT (api + web) no registry Harbor
do home-lab. Disparados por push no Gitea local (mirror) ou manualmente via `kubectl create`.

```
.
├── kustomization.yaml              # apply ordenado (kubectl apply -k .)
├── serviceaccount.yaml             # SA tekton-amfit + Role/RoleBinding
├── secret-template.yaml            # TEMPLATE — NÃO commitar credenciais reais
├── task-git-clone.yaml             # Task local de git clone (fallback do Catalog)
├── task-golang-test.yaml           # go vet + go test -race em apps/api/
├── task-kaniko-build-push.yaml     # build/push com Kaniko (sem Docker daemon)
├── pipeline-api.yaml               # amfit-build-api (clone → test → build/push)
├── pipeline-web.yaml               # amfit-build-web (clone → build/push)
├── pipelinerun-api-manual.yaml     # smoke run manual da API
├── pipelinerun-web-manual.yaml     # smoke run manual do Web
└── trigger-amfit.yaml              # EventListener + Trigger + Binding + Template
```

## Pré-requisitos no cluster

- Tekton Pipelines instalado (`tekton-pipelines` namespace)
- Tekton Triggers instalado (interceptors `gitea` e `cel` disponíveis)
- Namespace `cicd` existente (já é o namespace do ArgoCD)
- Storage class `local-path` (default no K3s)
- Nó com label `workload=cicd` (ex.: `k3s-worker-cicd`, 192.168.1.31)

Verifique:

```bash
kubectl get ns cicd
kubectl get pods -n tekton-pipelines
kubectl get clusterinterceptors gitea cel
kubectl get nodes -l workload=cicd
```

## Setup inicial (uma vez)

### 1. Criar os Secrets reais

Os Secrets ficam **fora do Git** e são criados imperativamente:

```bash
# Harbor — push de imagens
kubectl create secret docker-registry harbor-creds \
  --docker-server=harbor.infra.local \
  --docker-username=<HARBOR_USER> \
  --docker-password=<HARBOR_CLI_SECRET> \
  --docker-email=jose.mussauer@stone.com.br \
  -n cicd

# Gitea — clone do repo privado
kubectl create secret generic gitea-creds \
  --type=kubernetes.io/basic-auth \
  --from-literal=username=<GITEA_USER> \
  --from-literal=password=<GITEA_TOKEN> \
  -n cicd

kubectl annotate secret gitea-creds -n cicd \
  tekton.dev/git-0=http://gitea.lab.local

# Webhook HMAC (token forte aleatório, anote para configurar no Gitea)
WEBHOOK_TOKEN="$(openssl rand -hex 32)"
echo "$WEBHOOK_TOKEN"
kubectl create secret generic gitea-webhook-secret \
  --from-literal=secretToken="$WEBHOOK_TOKEN" \
  -n cicd
```

### 2. Aplicar a stack Tekton

```bash
kubectl apply -k infra/tekton/
```

ArgoCD vai sincronizar isso automaticamente se `infra/tekton/` for adicionado a uma
Application. Para o primeiro deploy manual, o `apply -k` acima é suficiente.

### 3. Verificar

```bash
kubectl get pipelines,tasks,sa,role,rolebinding -n cicd -l app.kubernetes.io/name=amfit-tekton
kubectl get eventlistener,trigger,triggertemplate,triggerbinding -n cicd
```

## Disparar um pipeline manualmente (smoke test)

Use `kubectl create` (não `apply`) para gerar nome único a cada execução:

```bash
# API
kubectl create -f infra/tekton/pipelinerun-api-manual.yaml -n cicd

# Web
kubectl create -f infra/tekton/pipelinerun-web-manual.yaml -n cicd
```

### Acompanhar logs

Com a CLI [tkn](https://tekton.dev/docs/cli/):

```bash
# Logs em tempo real do último PipelineRun
tkn pipelinerun logs --last -f -n cicd

# Listar
tkn pipelinerun list -n cicd

# Logs de um run específico
tkn pipelinerun logs amfit-build-api-manual-xxxxx -f -n cicd
```

Sem `tkn`:

```bash
kubectl get pipelinerun -n cicd -w
kubectl describe pipelinerun <NAME> -n cicd
kubectl logs -n cicd -l tekton.dev/pipelineRun=<NAME> -f --all-containers
```

## Configurar webhook no Gitea

1. **Expor o EventListener.** O Service criado pelo EventListener (`el-amfit-event-listener`)
   é ClusterIP por padrão. Como o lab já tem o `gitea-event-listener` exposto em
   `192.168.1.204` via MetalLB, o ideal é roteá-lo via Ingress Traefik dedicado, ou
   adicionar uma rota no Gitea-side. Para teste rápido, faça port-forward:

   ```bash
   kubectl port-forward -n cicd svc/el-amfit-event-listener 8080:8080
   # webhook URL local: http://localhost:8080
   ```

   Para produção do lab, crie um IngressRoute Traefik apontando para
   `el-amfit-event-listener:8080` em um host como `tekton-amfit.lab.local`.

2. **No Gitea**, repositório `labadmin/amfit` → **Settings** → **Webhooks** → **Add Webhook** → **Gitea**:

   - **Target URL:** `http://tekton-amfit.lab.local/` (ou o endpoint exposto)
   - **HTTP Method:** `POST`
   - **POST Content Type:** `application/json`
   - **Secret:** valor de `$WEBHOOK_TOKEN` gerado no setup
   - **Trigger On:** `Push Events`
   - **Branch filter:** `main`
   - **Active:** `[x]`

3. **Testar:** clique em **Test Delivery** no Gitea. Você deve ver:

   ```bash
   kubectl get pipelinerun -n cicd -w
   ```

   Dois PipelineRuns sendo criados (`amfit-build-api-<sha>-...` e `amfit-build-web-<sha>-...`).

## Troubleshooting

### Kaniko: `error pushing image: unauthorized`

- O Secret `harbor-creds` não tem o `.dockerconfigjson` correto, ou aponta para servidor
  errado. Recrie:

  ```bash
  kubectl delete secret harbor-creds -n cicd
  kubectl create secret docker-registry harbor-creds --docker-server=harbor.infra.local ...
  ```

- O `dockerconfig` workspace precisa montar como `config.json` (não `.dockerconfigjson`).
  Já está configurado nos PipelineRun manifests.

### Kaniko: `failed to push to cache repository`

- O Harbor precisa ter o projeto `amfit/cache` criado e o usuário do `harbor-creds`
  com permissão de push nele. Crie via UI do Harbor ou:

  ```bash
  curl -u <user>:<pass> -X POST http://harbor.infra.local/api/v2.0/projects \
    -H 'Content-Type: application/json' \
    -d '{"project_name":"cache","public":false}'
  ```

### Kaniko: `pull rate limit` em imagens base do Dockerfile

- Configure um proxy cache no Harbor para Docker Hub (Harbor → Project → Configure
  como Proxy Cache) e ajuste os `FROM` dos Dockerfiles para
  `harbor.infra.local/dockerhub-proxy/library/<imagem>`.

### `git clone failed: authentication required`

- Verifique se a anotação `tekton.dev/git-0` está no Secret `gitea-creds`:

  ```bash
  kubectl get secret gitea-creds -n cicd -o yaml | grep tekton.dev/git-0
  ```

- O token Gitea precisa ter pelo menos `read:repository`.

### `go test -race` falhando por OOM no nó

- O `golang-test` reserva 1Gi e tem limit de 2Gi. Se faltar memória no nó
  `k3s-worker-cicd`, ou ajuste limits, ou direcione para o `ci-runner` (192.168.1.32)
  com `nodeSelector: { kubernetes.io/hostname: ci-runner }` no `podTemplate` do
  PipelineRun.

### EventListener não recebe eventos

- Verifique logs:

  ```bash
  kubectl logs -n cicd -l eventlistener=amfit-event-listener -f
  ```

- HMAC inválido: o Secret do webhook no Gitea **deve ser igual** ao
  `gitea-webhook-secret.secretToken` no cluster.

- O EventListener registra todo payload recebido — útil pra debugar binding incorreto.

### Como cancelar um PipelineRun travado

```bash
tkn pipelinerun cancel <NAME> -n cicd
# ou
kubectl patch pipelinerun <NAME> -n cicd --type=merge \
  -p '{"spec":{"status":"PipelineRunCancelled"}}'
```

## Próximos passos (Fase 2)

- Path filtering no `cel` interceptor: só dispara `amfit-build-api` se o commit alterar
  `apps/api/**` ou `packages/shared/**`.
- Adicionar Task `update-image-tag` que faz commit em `infra/k8s/` substituindo a tag
  da imagem (GitOps via ArgoCD image updater ou commit direto).
- SAST/IaC scan: adicionar `trivy` (image scan pós-push) e `checkov` (manifestos K8s)
  como Tasks adicionais.
- Notificação no canal Slack/Mattermost via TaskRun pós-pipeline.
