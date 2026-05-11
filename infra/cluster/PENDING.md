# Pendências de infra para o deploy do AMFIT completar

## 1. DNS interno do lab para `harbor.infra.local` — **RESOLVIDO** (2026-05-11)

**Status:** Pi-hole deployado no cluster K3s em 192.168.1.53. Todos os 5 nós
configurados para usar Pi-hole como DNS primário via playbook Ansible
`infra-lab/ansible/playbooks/06-internal-dns.yml`. Registros A criados via
ConfigMap `pihole-custom-dns` cobrindo `*.lab.local`, `*.infra.local` e
`*.amfit.local`. Ver `infra-lab/kubernetes/network-services/pihole/`.

**Status original:** pendente. Configurar no Pi-hole / dnsmasq da rede do lab.

**Por quê:** o `containerd` em cada nó do K3s **NÃO usa o CoreDNS do
cluster** — usa o resolver do próprio nó. Como o build via Tekton/Kaniko
roda dentro de Pods (CoreDNS), o push funciona. Mas o pull de imagem
pelo container runtime falha:

```
Failed to pull image "harbor.infra.local/amfit/api:latest":
... dial tcp: lookup harbor.infra.local: Try again
```

**Como resolver:** adicionar registro A no DNS interno da rede:

```
harbor.infra.local  →  192.168.1.202  (Harbor LB IP)
gitea.lab.local     →  192.168.1.201
argocd.lab.local    →  192.168.1.203
api.amfit.local     →  192.168.1.205
app.amfit.local     →  192.168.1.206
minio.amfit.local   →  192.168.1.207
```

**Após o fix:** ArgoCD com `selfHeal: true` retoma os pulls
automaticamente. Esperado: amfit-api e amfit-web sobem em poucos
minutos. MinIO já está Running.

---

## 1.1 Trust do `containerd` no CA do Harbor — **RESOLVIDO** (2026-05-11)

**Status:** CA do Harbor instalado no trust store dos 5 nós K3s via playbook
`infra-lab/ansible/playbooks/07-k3s-registries.yml` (Opção B — install CA).
Validado: `curl https://harbor.lab.local/v2/` retorna HTTP 401 sem `-k`, e
`crictl pull harbor.lab.local/amfit/api:latest` baixou a imagem com sucesso.

**Por que a Opção A (registries.yaml `insecure_skip_verify`) não funcionou:**
K3s v1.29.3 gera o `hosts.toml` em formato legacy (top-level `skip_verify`),
mas o containerd 1.7+ requer `skip_verify` dentro do bloco `[host."..."]`.
A config é gerada mas não é honrada. A Opção B (instalar o CA no trust store
do SO) é mais correta e contorna o bug.

**Status original:** descoberto após o fix do DNS (item 1). Bloqueia o pull
das imagens `harbor.lab.local/amfit/*` pelos nós do K3s.

**Sintoma:**

```
Failed to pull image "harbor.lab.local/amfit/api:latest":
... tls: failed to verify certificate: x509: certificate signed by unknown authority
```

**Por quê:** o Harbor do lab usa certificado auto-assinado (CA
interno do lab, não pública). `containerd` em cada nó valida TLS
contra o trust store do SO, que não tem o CA do lab.

**Como resolver — escolher uma:**

### Opção A (mais simples) — `registries.yaml` com `insecure_skip_verify`

Em cada nó do cluster, criar/atualizar `/etc/rancher/k3s/registries.yaml`:

```yaml
mirrors:
  "harbor.lab.local":
    endpoint:
      - "https://harbor.lab.local"
configs:
  "harbor.lab.local":
    tls:
      insecure_skip_verify: true
```

E reiniciar o agent K3s:

```bash
sudo systemctl restart k3s-agent   # workers
sudo systemctl restart k3s         # control-plane
```

Recomendado: aplicar via playbook Ansible (ex.:
`infra-lab/ansible/playbooks/07-k3s-registries.yml`).

### Opção B (mais correta) — instalar CA do Harbor no trust store

```bash
sudo cp harbor-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
sudo systemctl restart k3s-agent
```

Requer extrair o CA do Harbor primeiro. Mais defensivo (não pula
verificação) mas mais trabalho.

**Após o fix:** `kubectl delete pod -n amfit -l app.kubernetes.io/name=amfit-api`
e `... amfit-web` para resetar o ImagePullBackOff. ArgoCD selfHeal
não força recriação porque o Pod está "Pending" do ponto de vista
dele, não Degraded.

---

## 1.2 `imagePullSecrets` ausente nos Deployments do AMFIT — **PENDENTE** (2026-05-11)

**Status:** descoberto após o fix do CA (item 1.1). Bloqueia o pull das
imagens `harbor.lab.local/amfit/*` por falta de autenticação.

**Sintoma:**

```text
Failed to pull image "harbor.lab.local/amfit/api:latest":
... pull access denied, repository does not exist or may require authorization:
authorization failed: no basic auth credentials
```

**Por quê:** o Harbor exige autenticação para pull (não é projeto público).
O `containerd` em cada nó não tem credenciais — quem deve passar é o Pod via
`imagePullSecrets`. Os Deployments `amfit-api` e `amfit-web` do AMFIT não
declaram um `imagePullSecrets` apontando para um secret docker-registry no
namespace `amfit`.

**Como resolver:**

1. Criar Secret docker-registry no namespace `amfit` com credenciais do Harbor:

   ```bash
   kubectl create secret docker-registry harbor-pull-secret \
     --docker-server=harbor.lab.local \
     --docker-username=admin \
     --docker-password=Harbor12345! \
     --namespace=amfit
   ```

2. Referenciar o secret nos `Deployment.spec.template.spec.imagePullSecrets`
   de `infra/k8s/api/deployment.yaml` e `infra/k8s/web/deployment.yaml`:

   ```yaml
   spec:
     template:
       spec:
         imagePullSecrets:
           - name: harbor-pull-secret
         containers:
           - name: api
             image: harbor.lab.local/amfit/api:latest
   ```

3. Commit + push → ArgoCD aplica automaticamente.

**Alternativa (sem editar Deployments):** atrelar o secret ao ServiceAccount
default do namespace `amfit`:

```bash
kubectl patch sa default -n amfit --type=json -p='[{
  "op": "add",
  "path": "/imagePullSecrets",
  "value": [{"name": "harbor-pull-secret"}]
}]'
```

---

## 2. Ajuste do Secret `amfit-secrets` no GitOps — **RESOLVIDO** (2026-05-11)

**Status:** Sealed Secrets controller v0.36.6 instalado no cluster
(ver `infra-lab/kubernetes/sealed-secrets/` e ADR-011). O secret real
do `amfit-secrets` foi exportado, encriptado offline com o cert público
do controller e salvo em `infra/k8s/api/sealedsecret.yaml`.

**Próximos passos no repo AMFIT (manuais — fora do escopo do infra-lab):**

1. Adicionar `sealedsecret.yaml` à Kustomization do AMFIT (mesma pasta que
   `deployment.yaml`, `service.yaml`).
2. **Remover** `secret.yaml` antigo com placeholders.
3. Remover `ignoreDifferences` do `Application` do ArgoCD para `amfit-secrets`
   (não é mais necessário — o SealedSecret tem o conteúdo real).
4. Commit + push → ArgoCD aplica → controller decripta → Secret `amfit-secrets`
   é recriado idêntico ao atual (não há mudança operacional para os pods).

**Como criar novos secrets para o AMFIT no futuro:**

```bash
# No repo do infra-lab:
kubectl create secret generic novo-secret \
  --from-literal=KEY=valor \
  --namespace=amfit \
  --dry-run=client -o yaml > /tmp/secret.yaml

./scripts/seal-secret.sh /tmp/secret.yaml > /caminho/amfit/infra/k8s/sealed-novo.yaml

# Commit no repo AMFIT — ArgoCD pega e o controller decripta.
shred -u /tmp/secret.yaml
```

**Status original:** workaround em produção (ignoreDifferences). Decisão para
fase posterior.

**Estado original:** o `infra/k8s/api/secret.yaml` no repo continha
**placeholders** (`REPLACE_WITH_*_PEM`). A Secret real no cluster foi
criada manualmente via `kubectl create secret docker-registry` com
as chaves JWT geradas localmente. ArgoCD ignorava diff em `/data`
através de `ignoreDifferences`, então o conteúdo real não era
sobrescrito.

**Risco (era):** se a Secret fosse deletada do cluster e o ArgoCD ressyncasse,
os pods usariam os placeholders e a API falharia ao carregar as chaves JWT.

---

## 3. CoreDNS pinned em `k3s-server`

**Status:** workaround temporário aplicado em sessão anterior. Ver
`LAB-BUGS.md` #3 para detalhes. Conforme o `LAB-BUGS.md` atualizado,
foi marcado como resolvido — validar se o nodeSelector foi removido
ou se ainda está fixado.

---

## Validação final pós-resolução

```bash
# DNS deve resolver de qualquer nó:
ssh user@192.168.1.31 nslookup harbor.infra.local

# ArgoCD deve mostrar tudo Healthy:
kubectl get application amfit -n cicd

# Pods devem estar Running:
kubectl get pods -n amfit

# Smoke test da API:
curl http://192.168.1.205:8080/healthz   # deve retornar 200 ok
```
