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

## 2. Ajuste do Secret `amfit-secrets` no GitOps

**Status:** workaround em produção (ignoreDifferences). Decisão para
fase posterior.

**Estado atual:** o `infra/k8s/api/secret.yaml` no repo contém
**placeholders** (`REPLACE_WITH_*_PEM`). A Secret real no cluster foi
criada manualmente via `kubectl create secret docker-registry` com
as chaves JWT geradas localmente. ArgoCD ignora diff em `/data`
através de `ignoreDifferences`, então o conteúdo real não é
sobrescrito.

**Risco:** se a Secret for deletada do cluster e o ArgoCD ressyncar,
os pods vão usar os placeholders e a API falha ao carregar as chaves
JWT.

**Soluções definitivas (escolher uma):**
- Migrar para **Sealed Secrets** (já tem ArgoCD, requer kubeseal +
  controller no cluster)
- Migrar para **SOPS + age** com Kustomize KSops plugin
- **External Secrets Operator** apontando para Vault/AWS SM/etc

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
