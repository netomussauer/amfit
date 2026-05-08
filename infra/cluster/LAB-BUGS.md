# Bugs do home-lab descobertos durante a entrega do AMFIT

Documentados aqui para referência quando atacar no repo `infra-lab`. **Estes
bugs não são do AMFIT** — afetam todo o cluster e devem ser corrigidos na
camada base.

Descobertos em 2026-05-08 durante o primeiro PipelineRun manual da imagem
AMFIT API.

> **Status (2026-05-08 17:15):** todos os 3 bugs **RESOLVIDOS** no `infra-lab`.
> Fixes aplicados e validados. Documentação dos fixes em
> `infra-lab/docs/runbook.md` seções P20, P21 e P22.
> AMFIT está liberado para retomar o build via Tekton sem workarounds.

---

## Bug #1 — Gitea mirror falha por musl getaddrinfo — **RESOLVIDO**

### Sintoma

A partir do dia 8/maio às ~17:10 UTC, o sync do mirror GitHub→Gitea passou a
falhar consistentemente:

```
SyncMirrors [repo: <Repository 2:labadmin/amfit>]: failed to update mirror repository:
Stderr: fatal: unable to access 'https://github.com/netomussauer/amfit.git/':
        Could not resolve host: github.com
Err: exit status 128
```

### Diagnóstico

- DNS está funcional: `nslookup github.com` (busybox) resolve para 4.228.31.150
- `getent hosts github.com` (glibc API) **falha silenciosamente** dentro do
  pod Gitea
- `git ls-remote https://github.com/...` falha com "Could not resolve host"
- Pod do Gitea usa imagem `gitea/gitea:1.25.5` (Alpine-based, musl libc)
- Mesmo bug observado com `alpine/git:2.43.0` em outros pods de teste

### Root cause

**musl libc tem comportamento bugado no `getaddrinfo()`** quando combinado com:
- `options ndots:5` no `/etc/resolv.conf` (default do Kubernetes)
- Múltiplos search domains incluindo TLDs como `.local`
- Queries paralelas A + AAAA contra CoreDNS

Mesmo problema documentado em https://github.com/gliderlabs/docker-alpine/issues/8.

### Workaround pro AMFIT (não aplicado)

Adicionar `dnsConfig` ao `Deployment` do Gitea via override no Helm values:

```yaml
spec:
  template:
    spec:
      dnsPolicy: None
      dnsConfig:
        nameservers:
          - 10.43.0.10
        searches:
          - cicd.svc.cluster.local
          - svc.cluster.local
          - cluster.local
        options:
          - { name: ndots, value: "1" }
          - { name: single-request-reopen }
```

### Fix correto (a aplicar no infra-lab)

Aplicar o `dnsConfig` acima a TODOS os Deployments do lab que usam imagens
Alpine (Gitea, Harbor exporter, etc), preferencialmente via MutatingWebhook
ou diretamente nos Helm values.

Alternativa: adicionar plugin `template` no CoreDNS para reescrever queries
do tipo `*.cicd.svc.cluster.local` que vêm de hosts externos (`github.com.cicd...`)
e responder NXDOMAIN imediato sem timeout.

### Por que apareceu agora?

Possivelmente ligado ao restart do CoreDNS hoje (que mudou o cache state).
Antes do restart, sync do mirror funcionava — Gitea mantém commits até
`3f0796e` no repo `labadmin/amfit`.

---

## Bug #2 — Nó k3s-worker-cicd com egress restrito a alguns CDNs — **RESOLVIDO** (era o mesmo Bug #1)

### Sintoma

Pods agendados em `k3s-worker-cicd` (192.168.1.31) falham ao acessar:
- `dl-cdn.alpinelinux.org` — timeout em qualquer porta
- Algumas revisions de `proxy.golang.org` (mas a maioria funciona)
- `rancher/mirrored-coredns-coredns:1.10.1` — pull demora > timeout (DeadlineExceeded)

Mas funciona OK com:
- `docker.io/bitnami/git:latest`
- `docker.io/golang:1.22-bookworm`
- `gcr.io/kaniko-project/executor:v1.23.2`

### Diagnóstico (a confirmar)

DNS resolve normalmente. Issue está no nível TCP/HTTP. Possíveis causas:

1. **Firewall do gateway/Pi-hole** bloqueando alguns CDNs específicos
2. **MTU mismatch** entre o nó e o gateway (problemas com pacotes grandes
   passando por VPN/tunnel)
3. **DNS Forwarder** do nó com upstream limitado/com bloqueio
4. **Connection limits** ou rate limiting no firewall

### Diagnóstico recomendado

Via SSH no nó `k3s-worker-cicd`:

```bash
# Test conectividade básica
curl -v --connect-timeout 5 https://dl-cdn.alpinelinux.org 2>&1 | head -20
nslookup dl-cdn.alpinelinux.org

# MTU check
ping -M do -s 1472 8.8.8.8  # 1500 - 28 (header)
ping -M do -s 1452 dl-cdn.alpinelinux.org

# Firewall do nó
sudo iptables -L -n -v | head -40
sudo nft list ruleset 2>/dev/null | head -40

# Rotas
ip route
ip rule

# Compare com nó que funciona (k3s-server)
```

### Workarounds aplicados no AMFIT (não definitivos)

- Removido `apk add git` do `apps/api/Dockerfile` (não era necessário)
- Trocado `golang:1.22-alpine` por `golang:1.22-bookworm` no `task-golang-test`
  (Debian já tem build-base + git pre-instalados)
- Criada Task `amfit-git-clone` com `bitnami/git:latest` (glibc) em vez de
  `alpine/git` (Alpine/musl)

### Fix correto (a aplicar no infra-lab)

Corrigir o egress permitirá:
- Voltar para imagens slim (alpine) onde fizer sentido
- Habilitar `apk add` em build steps do Tekton sem workaround
- Confiabilidade geral do CI/CD

---

## Bug #3 — CoreDNS pinned em k3s-server por falta de imagem cacheada — **RESOLVIDO**

### Sintoma

Após `kubectl rollout restart deployment/coredns -n kube-system`, o novo Pod
ficou em `ImagePullBackOff` no nó `ubuntu-neto`. Apenas `k3s-server` tinha a
imagem `rancher/mirrored-coredns-coredns:1.10.1` cacheada.

### Workaround aplicado

```bash
kubectl patch deploy coredns -n kube-system --type=strategic \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"k3s-server"}}}}}'
```

### Fix correto

1. **Pre-pull da imagem CoreDNS** em todos os 5 nós, ou
2. **Configurar K3s mirror registry** apontando para Harbor com proxy cache,
   eliminando dependência do Docker Hub no path crítico do CoreDNS, ou
3. **Remover o nodeSelector** quando a imagem estiver cacheada em todos os
   nós (com `imagePullPolicy: IfNotPresent`).

---

## Estado pós-debug

Quando os 3 bugs forem resolvidos no `infra-lab`, o AMFIT estará
**imediatamente deployável** sem nenhuma mudança de código:

```bash
# 1. Sync do Gitea volta a funcionar (Bug #1 fixado)
# 2. Build images via Tekton:
kubectl create -f infra/tekton/pipelinerun-api-manual.yaml -n cicd
kubectl create -f infra/tekton/pipelinerun-web-manual.yaml -n cicd
# 3. ArgoCD sincroniza:
kubectl apply -f infra/argocd/application.yaml
```
