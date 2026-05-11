# SDD — AMFIT: Plataforma de Controle de Atividades Físicas

**Versão:** 1.0.0  
**Data:** 2026-05-05  
**Autor:** Arquitetura — José Mussauer  
**Status:** Rascunho para validação

---

## Resumo Executivo

AMFIT é uma plataforma de gestão de treinos de musculação com dois perfis de usuário distintos: o personal trainer e o aluno. O personal trainer acessa a plataforma tanto pelo **portal web** (administração completa: gestão de alunos, montagem de fichas, biblioteca de exercícios, dashboard) quanto pelo **app mobile** (cadastro de exercícios, acompanhamento de alunos em campo). O aluno utiliza exclusivamente o aplicativo mobile Android/iOS para executar e registrar seus treinos.

A solução adota arquitetura de microserviços leve (monolito modular no MVP, preparado para extração de serviços), backend Go com Fiber, banco PostgreSQL, storage MinIO, frontend web em Next.js 14 (App Router) e aplicativo mobile em React Native com Expo. Todo o stack é self-hostable no cluster K3s existente.

---

## 1. Decisões Arquiteturais (ADRs)

### ADR-001 — Mobile: Expo (React Native + TypeScript)

**Contexto:** Time pequeno (2-3 devs), necessidade de publicar em Android e iOS, preferência por TypeScript no frontend, possível reuso de lógica com o portal web.

**Alternativas avaliadas:**

| Opção | Prós | Contras |
|---|---|---|
| Flutter (Dart) | Performance nativa, UI consistente, ótimo hot-reload | Dart isola o codebase do ecossistema JS/TS; sem reuso com web |
| React Native puro | Ecossistema JS, compartilha lógica com web | Setup manual de native modules, configuração de build complexa |
| Expo (sobre React Native) | DX superior, EAS Build na nuvem, OTA updates, managed workflow | Leve overhead de runtime; funcionalidades nativas avançadas exigem config extra |

**Decisão:** Expo com Managed Workflow (TypeScript).

**Justificativa:**
- Time pequeno obtém máxima produtividade sem gerenciar builds nativos localmente — EAS Build compila na nuvem.
- Codebase 100% TypeScript compartilha schemas Zod, tipos de API e lógica de validação com o portal web via pacote interno do monorepo.
- Expo Router (file-based, sobre React Navigation) replica a experiência do Next.js App Router, reduzindo a curva para devs web.
- OTA updates via Expo Updates permitem entregar correções sem passar pelas stores — crítico para um MVP com iteração rápida.
- Performance é suficiente para o caso de uso (listas, formulários, animações simples de conclusão de série).

**Trade-off aceito:** Funcionalidades nativas avançadas (Bluetooth com balanças, câmera para análise postural) exigirão Expo Bare Workflow ou development builds — aceitável pós-MVP.

---

### ADR-002 — Backend: Go + Fiber (monolito modular)

**Contexto:** Usuário tem expertise em Go; sistema precisa de API REST com autenticação JWT, upload de mídia e lógica de negócio moderadamente complexa.

**Decisão:** Go 1.22+ com Fiber v3, estrutura hexagonal, PostgreSQL 16, MinIO para mídia.

**Justificativa:**
- Go compila para binário único sem runtime externo — ideal para containers pequenos no K3s.
- Fiber tem ergonomia próxima ao Express/Fastify, com performance superior ao Node.js para I/O-bound (conexões HTTPS concorrentes).
- Monolito modular no MVP: os bounded contexts são pacotes Go separados em `internal/`, comunicando via interfaces. Extração para microserviços é possível sem reescrever contratos.
- Latência p99 < 100ms para as operações core (buscar ficha do dia, registrar série) com o stack proposto.

**Alternativas descartadas:**
- Node/Fastify: performance adequada, mas não há ganho real dado expertise em Go; bundle de dependências Node é mais pesado para container.
- Python/FastAPI: mais lento para I/O concorrente; justificaria apenas se houvesse integração com ML/análise de dados.

---

### ADR-003 — Banco de Dados: PostgreSQL 16

**Decisão:** PostgreSQL como único banco relacional para dados estruturados.

**Justificativa:**
- Modelo de dados é naturalmente relacional (treino → exercícios → séries → execuções).
- JSONB para atributos variáveis de exercícios (parâmetros específicos por modalidade).
- Row-Level Security para isolar dados de alunos por personal trainer.
- Extensão `pg_cron` para jobs de notificação e geração de alertas.
- Já contemplado no stack de infra-lab (operações conhecidas).

**Migrations:** golang-migrate com pares up/down versionados em `migrations/`.

---

### ADR-004 — Storage de Mídia: MinIO

**Decisão:** MinIO como object storage S3-compatible self-hosted.

**Justificativa:**
- Exercícios têm GIFs e vídeos demonstrativos — não adequado para PostgreSQL.
- MinIO roda no K3s com um StatefulSet, API 100% compatível com AWS S3.
- SDK Go oficial do MinIO; migração para S3 real em produção cloud é zero-code.
- Bucket policies: mídia de exercícios pública (CDN-ready), mídia de usuários privada com presigned URLs.

---

### ADR-005 — Autenticação: JWT + Refresh Token

**Decisão:** JWT assimétrico (RS256) com access token (15min) e refresh token (30 dias) armazenado em `httpOnly` cookie no web e SecureStore no mobile.

**Fluxo:**
- Access token carrega `user_id`, `role` (PERSONAL | ALUNO), `tenant_id` (personal trainer do aluno).
- Refresh token rotacionado a cada uso (rotation pattern) para detecção de roubo.
- Tabela `refresh_tokens` no PostgreSQL com `jti` para revogação.

---

### ADR-006 — Monorepo com pnpm Workspaces

**Decisão:** Monorepo único com pnpm Workspaces para os pacotes frontend/mobile e Go para o backend.

**Justificativa:**
- Schemas Zod, tipos TypeScript e constantes de domínio são compartilhados entre web e mobile via pacote `@amfit/shared`.
- Um único repositório simplifica CI/CD no pipeline Tekton do infra-lab.
- Go não participa do workspace pnpm — tem seu próprio `go.mod` em `apps/api/`.

---

## 2. Bounded Contexts (DDD)

### Mapa de Contextos

```mermaid
flowchart TD
    subgraph Identity["Identity Context"]
        PT[PersonalTrainer]
        AL[Aluno]
        AUTH[Credenciais]
    end

    subgraph Catalog["Catalog Context"]
        EX[Exercicio]
        GM[GrupoMuscular]
        MD[Midia]
    end

    subgraph Training["Training Context"]
        FT[FichaTreino]
        TR[Treino A/B/C]
        IT[ItemTreino]
    end

    subgraph Execution["Execution Context"]
        SE[SessaoTreino]
        RS[RegistroSerie]
    end

    subgraph Progress["Progress Context"]
        EV[Evolucao]
        MED[Medidas]
        DASH[Dashboard]
    end

    Identity -->|ACL: personal_id| Training
    Catalog -->|Open Host: exercicio_id| Training
    Training -->|Open Host: ficha_id| Execution
    Execution -->|Domain Events: sessao.concluida| Progress
    Identity -->|Open Host: aluno_id| Progress
```

### Ubiquitous Language por Contexto

**Identity Context**
- `PersonalTrainer`: profissional que cadastra e gerencia alunos e treinos.
- `Aluno`: cliente vinculado a um personal; executa treinos.
- `Tenant`: o personal trainer age como tenant — seus alunos estão sob seu escopo.

**Catalog Context**
- `Exercicio`: movimento físico com nome, descrição, grupo muscular e mídia demonstrativa.
- `GrupoMuscular`: classificação anatômica do exercício (ex: Peitoral, Quadríceps).
- `Midia`: arquivo de vídeo ou GIF associado ao exercício.

**Training Context**
- `FichaTreino`: coleção de treinos nomeados (A, B, C) atribuída a um aluno.
- `Treino`: conjunto de exercícios com séries, repetições e carga sugerida.
- `ItemTreino`: entrada na ficha — exercício + parâmetros (séries, reps, carga, descanso).
- `Periodizacao`: vigência da ficha (data de início e fim).

**Execution Context**
- `SessaoTreino`: registro de uma execução completa de um treino em uma data.
- `RegistroSerie`: captura de uma série específica — carga real utilizada e reps executadas.
- `Status`: PENDENTE | EM_ANDAMENTO | CONCLUIDO | PULADO.

**Progress Context**
- `Evolucao`: série temporal de cargas registradas por exercício para um aluno.
- `Medidas`: dados antropométricos (peso, percentual de gordura, etc.).
- `IndiceFrequencia`: percentual de sessões concluídas no período.

---

## 3. Modelagem de Dados

### ERD Principal

```mermaid
erDiagram
    PERSONAL_TRAINER {
        uuid id PK
        string nome "not null"
        string email UK "not null"
        string telefone
        string cref "nullable"
        boolean ativo "default true"
        timestamp criado_em "default now()"
        timestamp atualizado_em
    }

    ALUNO {
        uuid id PK
        uuid personal_id FK
        string nome "not null"
        string email UK "not null"
        date data_nascimento
        enum sexo "M|F|OUTRO"
        string telefone
        boolean ativo "default true"
        timestamp criado_em
        timestamp atualizado_em
    }

    CREDENCIAL {
        uuid id PK
        uuid owner_id "user_id (personal ou aluno)"
        enum owner_type "PERSONAL|ALUNO"
        string password_hash "not null"
        timestamp ultimo_acesso
    }

    REFRESH_TOKEN {
        uuid id PK
        uuid owner_id FK
        string jti UK "JWT ID"
        timestamp expira_em
        boolean revogado "default false"
        timestamp criado_em
    }

    GRUPO_MUSCULAR {
        uuid id PK
        string nome UK "not null"
        string descricao
    }

    EXERCICIO {
        uuid id PK
        uuid personal_id FK "null = exercicio global"
        string nome "not null"
        string descricao
        uuid grupo_muscular_id FK
        string midia_url "nullable — MinIO presigned ou public"
        enum tipo_midia "VIDEO|GIF|IMAGEM"
        boolean ativo "default true"
        timestamp criado_em
    }

    FICHA_TREINO {
        uuid id PK
        uuid aluno_id FK
        uuid personal_id FK
        string nome "ex: Treino Hipertrofia Jan/2026"
        date vigencia_inicio
        date vigencia_fim "nullable"
        boolean ativa "default true"
        timestamp criado_em
        timestamp atualizado_em
    }

    TREINO {
        uuid id PK
        uuid ficha_id FK
        string letra "A|B|C|D|..."
        string nome "nullable — ex: Peito e Tríceps"
        int ordem "para exibição"
    }

    ITEM_TREINO {
        uuid id PK
        uuid treino_id FK
        uuid exercicio_id FK
        int ordem "posição no treino"
        int series "not null"
        string repeticoes "ex: 8-12, AMRAP"
        decimal carga_sugerida "kg, nullable"
        int descanso_segundos "nullable"
        string observacao "nullable"
    }

    SESSAO_TREINO {
        uuid id PK
        uuid aluno_id FK
        uuid treino_id FK
        date data_execucao "not null"
        enum status "EM_ANDAMENTO|CONCLUIDO|ABANDONADO"
        timestamp iniciado_em
        timestamp concluido_em "nullable"
        string observacao "nullable"
    }

    REGISTRO_SERIE {
        uuid id PK
        uuid sessao_id FK
        uuid item_treino_id FK
        int numero_serie "1, 2, 3..."
        decimal carga_realizada "nullable"
        int repeticoes_realizadas "nullable"
        boolean concluida "default false"
        timestamp executado_em
    }

    MEDIDA_CORPORAL {
        uuid id PK
        uuid aluno_id FK
        date data_medicao
        decimal peso_kg "nullable"
        decimal altura_cm "nullable"
        decimal gordura_pct "nullable"
        decimal massa_magra_kg "nullable"
        jsonb circunferencias "nullable — {cintura, quadril, braco...}"
        string observacao "nullable"
    }

    PERSONAL_TRAINER ||--o{ ALUNO : "gerencia"
    PERSONAL_TRAINER ||--o{ EXERCICIO : "cria (custom)"
    PERSONAL_TRAINER ||--o{ FICHA_TREINO : "elabora"
    ALUNO ||--o{ FICHA_TREINO : "possui"
    ALUNO ||--o{ SESSAO_TREINO : "executa"
    ALUNO ||--o{ MEDIDA_CORPORAL : "registra"
    FICHA_TREINO ||--|{ TREINO : "contém"
    TREINO ||--|{ ITEM_TREINO : "lista"
    ITEM_TREINO }|--|| EXERCICIO : "referencia"
    EXERCICIO }|--|| GRUPO_MUSCULAR : "pertence"
    SESSAO_TREINO ||--|{ REGISTRO_SERIE : "detalha"
    REGISTRO_SERIE }|--|| ITEM_TREINO : "referencia"
```

### Índices Críticos

```sql
-- Busca de fichas ativas por aluno
CREATE INDEX idx_ficha_aluno_ativa ON ficha_treino(aluno_id) WHERE ativa = true;

-- Sessões por aluno e data (dashboard + histórico)
CREATE INDEX idx_sessao_aluno_data ON sessao_treino(aluno_id, data_execucao DESC);

-- Evolução de carga por aluno e exercício (gráfico de progresso)
CREATE INDEX idx_registro_item_sessao ON registro_serie(item_treino_id, sessao_id);

-- Exercícios por personal + globais
CREATE INDEX idx_exercicio_personal ON exercicio(personal_id) WHERE ativo = true;
CREATE INDEX idx_exercicio_global ON exercicio(grupo_muscular_id) WHERE personal_id IS NULL AND ativo = true;

-- Refresh tokens por owner (logout)
CREATE INDEX idx_refresh_owner ON refresh_token(owner_id) WHERE revogado = false;
```

---

## 4. Arquitetura de Serviços

### Visão Geral de Contexto (C4 Level 1)

```mermaid
flowchart TD
    subgraph Users["Usuários"]
        PT_WEB["Personal Trainer\n(Browser)"]
        PT_MOB["Personal Trainer\n(iOS / Android)"]
        AL_USER["Aluno\n(iOS / Android)"]
    end

    subgraph AMFIT["AMFIT Platform"]
        WEB["Portal Web Admin\nNext.js 14 SSR"]
        MOBILE["App Mobile\nExpo / React Native\n(Aluno + Personal)"]
        API["AMFIT API\nGo + Fiber"]
        PG[("PostgreSQL 16")]
        MINIO[("MinIO\nObject Storage")]
        REDIS[("Redis\nCache + Sessão")]
    end

    PT_WEB -->|HTTPS| WEB
    PT_MOB -->|HTTPS| MOBILE
    AL_USER -->|HTTPS| MOBILE
    WEB -->|REST/JSON| API
    MOBILE -->|REST/JSON| API
    API -->|SQL| PG
    API -->|S3 API| MINIO
    API -->|GET/SET| REDIS
```

### Fluxo de Upload de Mídia

```mermaid
sequenceDiagram
    participant PT as Personal (Web)
    participant API as AMFIT API
    participant MINIO as MinIO

    PT->>API: POST /exercicios (multipart/form-data)
    API->>MINIO: PutObject (bucket: exercicios)
    MINIO-->>API: ETag + URL
    API->>API: Persiste exercicio com midia_url
    API-->>PT: 201 { id, midia_url }
    PT->>MINIO: GET midia_url (direto, public bucket)
```

### Fluxo de Execução de Treino (Mobile)

```mermaid
sequenceDiagram
    participant AL as Aluno (App)
    participant API as AMFIT API
    participant PG as PostgreSQL

    AL->>API: GET /alunos/me/treino-hoje
    API->>PG: SELECT ficha_ativa + treino_do_dia
    PG-->>API: ItemTreino[] com exercícios
    API-->>AL: TreinoHojeResponse

    AL->>API: POST /sessoes (treino_id)
    API->>PG: INSERT sessao_treino (EM_ANDAMENTO)
    API-->>AL: { sessao_id }

    loop Para cada série concluída
        AL->>API: PATCH /sessoes/{id}/series
        API->>PG: INSERT/UPDATE registro_serie
        API-->>AL: 200 OK
    end

    AL->>API: PATCH /sessoes/{id}/concluir
    API->>PG: UPDATE status=CONCLUIDO, concluido_em=now()
    API-->>AL: SessaoResponse
```

---

## 5. Contratos de API (OpenAPI 3.1)

```yaml
openapi: "3.1.0"
info:
  title: AMFIT API
  version: "1.0.0"
  description: API REST para a plataforma de gestão de treinos AMFIT

servers:
  - url: https://api.amfit.local
    description: Self-hosted K3s (infra-lab)

security:
  - BearerAuth: []

paths:

  # ── Auth ────────────────────────────────────────────────────────────

  /auth/login:
    post:
      tags: [Auth]
      summary: Autenticar usuário (personal ou aluno)
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LoginRequest"
      responses:
        "200":
          description: Tokens de acesso
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /auth/refresh:
    post:
      tags: [Auth]
      summary: Renovar access token via refresh token
      security: []
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /auth/logout:
    post:
      tags: [Auth]
      summary: Revogar refresh token
      responses:
        "204":
          description: Token revogado

  # ── Alunos ──────────────────────────────────────────────────────────

  /alunos:
    get:
      tags: [Alunos]
      summary: Listar alunos do personal autenticado
      parameters:
        - name: ativo
          in: query
          schema:
            type: boolean
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: per_page
          in: query
          schema:
            type: integer
            default: 20
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AlunoListResponse"

    post:
      tags: [Alunos]
      summary: Cadastrar novo aluno
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CriarAlunoRequest"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AlunoResponse"
        "422":
          $ref: "#/components/responses/ValidationError"

  /alunos/{id}:
    get:
      tags: [Alunos]
      parameters:
        - $ref: "#/components/parameters/IdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AlunoDetalheResponse"
        "404":
          $ref: "#/components/responses/NotFound"

  /alunos/me/treino-hoje:
    get:
      tags: [Alunos]
      summary: Retorna o treino do dia para o aluno autenticado
      description: |
        Determina qual treino (A/B/C) o aluno deve executar hoje
        com base na rotação e no último treino executado.
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TreinoHojeResponse"
        "204":
          description: Sem treino agendado para hoje

  # ── Exercícios ──────────────────────────────────────────────────────

  /exercicios:
    get:
      tags: [Exercicios]
      summary: Listar exercícios (globais + do personal)
      parameters:
        - name: grupo_muscular_id
          in: query
          schema:
            type: string
            format: uuid
        - name: busca
          in: query
          schema:
            type: string
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ExercicioListResponse"

    post:
      tags: [Exercicios]
      summary: Criar exercício customizado
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              $ref: "#/components/schemas/CriarExercicioRequest"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ExercicioResponse"

  # ── Fichas de Treino ────────────────────────────────────────────────

  /fichas:
    get:
      tags: [Fichas]
      summary: Listar fichas (filtro por aluno_id)
      parameters:
        - name: aluno_id
          in: query
          schema:
            type: string
            format: uuid
        - name: ativa
          in: query
          schema:
            type: boolean
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FichaListResponse"

    post:
      tags: [Fichas]
      summary: Criar nova ficha de treino
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CriarFichaRequest"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FichaResponse"

  /fichas/{id}/treinos:
    post:
      tags: [Fichas]
      summary: Adicionar treino (A/B/C) à ficha
      parameters:
        - $ref: "#/components/parameters/IdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CriarTreinoRequest"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TreinoResponse"

  /treinos/{id}/itens:
    post:
      tags: [Fichas]
      summary: Adicionar exercício ao treino
      parameters:
        - $ref: "#/components/parameters/IdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CriarItemTreinoRequest"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ItemTreinoResponse"

  # ── Sessões de Treino ───────────────────────────────────────────────

  /sessoes:
    post:
      tags: [Sessoes]
      summary: Iniciar sessão de treino
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [treino_id]
              properties:
                treino_id:
                  type: string
                  format: uuid
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SessaoResponse"

  /sessoes/{id}/series:
    patch:
      tags: [Sessoes]
      summary: Registrar resultado de uma série
      parameters:
        - $ref: "#/components/parameters/IdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RegistrarSerieRequest"
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RegistroSerieResponse"

  /sessoes/{id}/concluir:
    patch:
      tags: [Sessoes]
      summary: Concluir sessão de treino
      parameters:
        - $ref: "#/components/parameters/IdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SessaoResponse"

  # ── Dashboard (Personal) ────────────────────────────────────────────

  /dashboard:
    get:
      tags: [Dashboard]
      summary: Dados do dashboard do personal trainer
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DashboardResponse"

  # ── Progresso ───────────────────────────────────────────────────────

  /alunos/{id}/progresso/{exercicio_id}:
    get:
      tags: [Progresso]
      summary: Histórico de carga de um exercício para o aluno
      parameters:
        - $ref: "#/components/parameters/IdParam"
        - name: exercicio_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: periodo_dias
          in: query
          schema:
            type: integer
            default: 90
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProgressoExercicioResponse"

components:

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    IdParam:
      name: id
      in: path
      required: true
      schema:
        type: string
        format: uuid

  responses:
    Unauthorized:
      description: Não autenticado
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"
    NotFound:
      description: Recurso não encontrado
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"
    ValidationError:
      description: Dados inválidos
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

  schemas:

    ProblemDetail:
      type: object
      properties:
        type:   { type: string, format: uri }
        title:  { type: string }
        status: { type: integer }
        detail: { type: string }
        errors:
          type: array
          items:
            type: object
            properties:
              field:   { type: string }
              message: { type: string }

    LoginRequest:
      type: object
      required: [email, senha, tipo]
      properties:
        email: { type: string, format: email }
        senha: { type: string, minLength: 8 }
        tipo:
          type: string
          enum: [PERSONAL, ALUNO]

    AuthResponse:
      type: object
      properties:
        access_token:  { type: string }
        token_type:    { type: string, example: Bearer }
        expires_in:    { type: integer, example: 900 }
        usuario:
          type: object
          properties:
            id:   { type: string, format: uuid }
            nome: { type: string }
            role: { type: string, enum: [PERSONAL, ALUNO] }

    AlunoResponse:
      type: object
      properties:
        id:              { type: string, format: uuid }
        nome:            { type: string }
        email:           { type: string }
        telefone:        { type: string }
        data_nascimento: { type: string, format: date }
        sexo:            { type: string, enum: [M, F, OUTRO] }
        ativo:           { type: boolean }
        criado_em:       { type: string, format: date-time }

    AlunoListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/AlunoResponse"
        pagination:
          type: object
          properties:
            total:    { type: integer }
            page:     { type: integer }
            per_page: { type: integer }

    AlunoDetalheResponse:
      allOf:
        - $ref: "#/components/schemas/AlunoResponse"
        - type: object
          properties:
            ficha_ativa:
              $ref: "#/components/schemas/FichaResponse"
            ultima_sessao:
              type: string
              format: date
            total_sessoes_mes: { type: integer }

    CriarAlunoRequest:
      type: object
      required: [nome, email, senha]
      properties:
        nome:            { type: string, minLength: 2 }
        email:           { type: string, format: email }
        senha:           { type: string, minLength: 8 }
        telefone:        { type: string }
        data_nascimento: { type: string, format: date }
        sexo:            { type: string, enum: [M, F, OUTRO] }

    ExercicioResponse:
      type: object
      properties:
        id:               { type: string, format: uuid }
        nome:             { type: string }
        descricao:        { type: string }
        grupo_muscular:
          type: object
          properties:
            id:   { type: string, format: uuid }
            nome: { type: string }
        midia_url:        { type: string, format: uri, nullable: true }
        tipo_midia:       { type: string, enum: [VIDEO, GIF, IMAGEM], nullable: true }
        is_global:        { type: boolean }

    ExercicioListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/ExercicioResponse"

    CriarExercicioRequest:
      type: object
      required: [nome, grupo_muscular_id]
      properties:
        nome:              { type: string }
        descricao:         { type: string }
        grupo_muscular_id: { type: string, format: uuid }
        midia:
          type: string
          format: binary
          description: Arquivo de vídeo ou GIF (max 50MB)

    FichaResponse:
      type: object
      properties:
        id:              { type: string, format: uuid }
        nome:            { type: string }
        aluno_id:        { type: string, format: uuid }
        vigencia_inicio: { type: string, format: date }
        vigencia_fim:    { type: string, format: date, nullable: true }
        ativa:           { type: boolean }
        treinos:
          type: array
          items:
            $ref: "#/components/schemas/TreinoResponse"

    FichaListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/FichaResponse"

    CriarFichaRequest:
      type: object
      required: [aluno_id, nome, vigencia_inicio]
      properties:
        aluno_id:        { type: string, format: uuid }
        nome:            { type: string }
        vigencia_inicio: { type: string, format: date }
        vigencia_fim:    { type: string, format: date }

    TreinoResponse:
      type: object
      properties:
        id:     { type: string, format: uuid }
        letra:  { type: string, example: A }
        nome:   { type: string, nullable: true }
        ordem:  { type: integer }
        itens:
          type: array
          items:
            $ref: "#/components/schemas/ItemTreinoResponse"

    CriarTreinoRequest:
      type: object
      required: [letra, ordem]
      properties:
        letra: { type: string, maxLength: 2 }
        nome:  { type: string }
        ordem: { type: integer }

    ItemTreinoResponse:
      type: object
      properties:
        id:                { type: string, format: uuid }
        ordem:             { type: integer }
        exercicio:
          $ref: "#/components/schemas/ExercicioResponse"
        series:            { type: integer }
        repeticoes:        { type: string, example: "8-12" }
        carga_sugerida:    { type: number, nullable: true }
        descanso_segundos: { type: integer, nullable: true }
        observacao:        { type: string, nullable: true }

    CriarItemTreinoRequest:
      type: object
      required: [exercicio_id, series, repeticoes, ordem]
      properties:
        exercicio_id:      { type: string, format: uuid }
        ordem:             { type: integer }
        series:            { type: integer, minimum: 1 }
        repeticoes:        { type: string }
        carga_sugerida:    { type: number }
        descanso_segundos: { type: integer }
        observacao:        { type: string }

    TreinoHojeResponse:
      type: object
      properties:
        treino:
          $ref: "#/components/schemas/TreinoResponse"
        sessao_hoje_id:
          type: string
          format: uuid
          nullable: true
          description: ID da sessão já iniciada hoje, se existir

    SessaoResponse:
      type: object
      properties:
        id:            { type: string, format: uuid }
        treino_id:     { type: string, format: uuid }
        data_execucao: { type: string, format: date }
        status:        { type: string, enum: [EM_ANDAMENTO, CONCLUIDO, ABANDONADO] }
        iniciado_em:   { type: string, format: date-time }
        concluido_em:  { type: string, format: date-time, nullable: true }
        series:
          type: array
          items:
            $ref: "#/components/schemas/RegistroSerieResponse"

    RegistrarSerieRequest:
      type: object
      required: [item_treino_id, numero_serie, concluida]
      properties:
        item_treino_id:        { type: string, format: uuid }
        numero_serie:          { type: integer, minimum: 1 }
        concluida:             { type: boolean }
        carga_realizada:       { type: number, nullable: true }
        repeticoes_realizadas: { type: integer, nullable: true }

    RegistroSerieResponse:
      type: object
      properties:
        id:                    { type: string, format: uuid }
        item_treino_id:        { type: string, format: uuid }
        numero_serie:          { type: integer }
        concluida:             { type: boolean }
        carga_realizada:       { type: number, nullable: true }
        repeticoes_realizadas: { type: integer, nullable: true }
        executado_em:          { type: string, format: date-time }

    DashboardResponse:
      type: object
      properties:
        alunos_ativos:         { type: integer }
        alunos_treinaram_hoje: { type: integer }
        alunos_sem_treino_7d:
          type: array
          items:
            type: object
            properties:
              id:         { type: string, format: uuid }
              nome:       { type: string }
              dias_ausente: { type: integer }
        sessoes_semana:        { type: integer }

    ProgressoExercicioResponse:
      type: object
      properties:
        exercicio:
          $ref: "#/components/schemas/ExercicioResponse"
        historico:
          type: array
          items:
            type: object
            properties:
              data:            { type: string, format: date }
              carga_maxima:    { type: number }
              volume_total:    { type: number, description: "soma carga * reps" }
              series_concluidas: { type: integer }
```

---

## 6. Arquitetura de Frontend Web (Admin Portal)

### Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR nativo, Server Components, File-based routing, integração Vercel/self-host |
| Linguagem | TypeScript 5.x | Type-safety, compartilhamento de tipos com mobile via monorepo |
| Estilo | Tailwind CSS 3.x | Utility-first, purge automático, integração com Design Tokens via CSS vars |
| Componentes | shadcn/ui | Componentes acessíveis (Radix UI), sem vendor lock-in, código copiável |
| Estado servidor | TanStack Query v5 | Cache, revalidação, optimistic updates, devtools |
| Formulários | React Hook Form + Zod | Validação alinhada ao backend, integração nativa com shadcn Form |
| Estado global | Zustand | Leve, sem boilerplate, para estado UI cross-feature (sidebar, tema) |
| Tabelas | TanStack Table v8 | Colunas dinâmicas, paginação server-side, sorting |
| Gráficos | Recharts | Composable, TypeScript-first, SSR-safe |
| Ícones | Lucide React | Consistente com shadcn/ui |

### Estrutura de Pastas (Feature-Based)

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Server Component
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Sidebar + Header
│   │   ├── page.tsx                  # Dashboard overview
│   │   ├── alunos/
│   │   │   ├── page.tsx              # Server: lista de alunos
│   │   │   ├── novo/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Detalhe do aluno
│   │   │       ├── ficha/page.tsx    # Montagem de ficha
│   │   │       └── progresso/page.tsx
│   │   ├── exercicios/
│   │   │   ├── page.tsx
│   │   │   └── novo/page.tsx
│   │   └── configuracoes/
│   │       └── page.tsx
│   ├── layout.tsx                    # Root layout (providers, fonts)
│   └── middleware.ts                 # Auth guard JWT
│
├── features/
│   ├── alunos/
│   │   ├── components/
│   │   │   ├── AlunoCard.tsx
│   │   │   ├── AlunoForm.tsx         # Client Component
│   │   │   ├── AlunoTable.tsx        # Client: TanStack Table
│   │   │   └── AlunoDetalheHeader.tsx
│   │   ├── hooks/
│   │   │   ├── useAlunos.ts          # TanStack Query
│   │   │   ├── useAluno.ts
│   │   │   └── useCriarAluno.ts      # useMutation
│   │   ├── schemas/
│   │   │   └── aluno.schema.ts       # Zod — espelha OpenAPI
│   │   └── index.ts
│   │
│   ├── fichas/
│   │   ├── components/
│   │   │   ├── FichaBuilder.tsx      # Drag-and-drop (dnd-kit)
│   │   │   ├── TreinoCard.tsx
│   │   │   ├── ItemTreinoRow.tsx
│   │   │   └── ExercicioSelector.tsx # Modal de busca de exercícios
│   │   ├── hooks/
│   │   │   ├── useFicha.ts
│   │   │   ├── useCriarFicha.ts
│   │   │   └── useAdicionarItem.ts
│   │   ├── schemas/
│   │   │   └── ficha.schema.ts
│   │   └── index.ts
│   │
│   ├── exercicios/
│   │   ├── components/
│   │   │   ├── ExercicioGrid.tsx
│   │   │   ├── ExercicioCard.tsx
│   │   │   ├── ExercicioForm.tsx     # Upload de mídia integrado
│   │   │   └── MidiaPreview.tsx
│   │   ├── hooks/
│   │   │   ├── useExercicios.ts
│   │   │   └── useCriarExercicio.ts
│   │   ├── schemas/
│   │   │   └── exercicio.schema.ts
│   │   └── index.ts
│   │
│   └── dashboard/
│       ├── components/
│       │   ├── AlunosHojeCard.tsx
│       │   ├── AlunosSemTreinoList.tsx
│       │   └── SessoesSemanaChart.tsx
│       ├── hooks/
│       │   └── useDashboard.ts
│       └── index.ts
│
├── shared/
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (copiados)
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── PageWrapper.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   ├── api-client.ts             # fetch wrapper JWT + error RFC 7807
│   │   └── query-client.ts           # TanStack Query config
│   └── types/
│       └── common.types.ts
│
└── styles/
    └── tokens.css                    # Design Tokens como CSS Custom Properties
```

### Design Tokens

```css
/* apps/web/styles/tokens.css */

/* ── Primitivos ─────────────────────────────────────────────── */
:root {
  /* Cores */
  --color-orange-400: #fb923c;
  --color-orange-500: #f97316;
  --color-orange-600: #ea580c;
  --color-slate-50:   #f8fafc;
  --color-slate-100:  #f1f5f9;
  --color-slate-700:  #334155;
  --color-slate-900:  #0f172a;
  --color-green-500:  #22c55e;
  --color-green-600:  #16a34a;
  --color-red-500:    #ef4444;
  --color-amber-500:  #f59e0b;
  --color-white:      #ffffff;

  /* Tipografia */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Escala */
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;

  /* Espaçamento (base 4px) */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Border radius */
  --radius-sm:   0.25rem;
  --radius-md:   0.5rem;
  --radius-lg:   0.75rem;
  --radius-xl:   1rem;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* ── Semânticos (light) ──────────────────────────────────────── */
:root {
  --color-primary:       var(--color-orange-500);
  --color-primary-hover: var(--color-orange-600);
  --color-primary-light: var(--color-orange-400);

  --color-success: var(--color-green-600);
  --color-danger:  var(--color-red-500);
  --color-warning: var(--color-amber-500);

  --color-bg:         var(--color-white);
  --color-bg-subtle:  var(--color-slate-50);
  --color-bg-muted:   var(--color-slate-100);
  --color-text:       var(--color-slate-900);
  --color-text-muted: #64748b;
  --color-border:     #e2e8f0;
}

/* ── Dark theme ──────────────────────────────────────────────── */
[data-theme="dark"] {
  --color-bg:         #0f172a;
  --color-bg-subtle:  #1e293b;
  --color-bg-muted:   #293548;
  --color-text:       #f1f5f9;
  --color-text-muted: #94a3b8;
  --color-border:     #334155;
}
```

### Mapa de Navegação Web

```mermaid
flowchart TD
    Login["/login"] --> Dashboard["/dashboard\nVisão Geral"]
    Dashboard --> Alunos["/alunos\nLista de Alunos"]
    Dashboard --> Exercicios["/exercicios\nBiblioteca"]
    Dashboard --> Config["/configuracoes"]

    Alunos --> AlunoNovo["/alunos/novo"]
    Alunos --> AlunoDetalhe["/alunos/[id]"]
    AlunoDetalhe --> FichaBuilder["/alunos/[id]/ficha\nMontagem de Ficha"]
    AlunoDetalhe --> Progresso["/alunos/[id]/progresso\nGráficos de Evolução"]

    Exercicios --> ExercicioNovo["/exercicios/novo"]
    FichaBuilder --> ExercicioSelector["Modal: Selecionar Exercício"]
```

---

## 7. Arquitetura do App Mobile (Expo)

### Stack Mobile

| Camada | Tecnologia |
|---|---|
| Framework | Expo SDK 51 + Expo Router v3 |
| Linguagem | TypeScript 5.x |
| Navegação | Expo Router (file-based, Stack + Tabs) |
| Estilo | NativeWind v4 (Tailwind para React Native) |
| Estado servidor | TanStack Query v5 |
| Formulários | React Hook Form + Zod (compartilhado via `@amfit/shared`) |
| Armazenamento | expo-secure-store (tokens JWT) |
| Animações | React Native Reanimated v3 |
| Mídia | expo-video + expo-image |

### Fluxo de Navegação Mobile (User Flow)

O app mobile serve **dois perfis** com fluxos distintos após o login. A role (`PERSONAL` | `ALUNO`) no JWT determina qual bottom tab navigator é montado.

```mermaid
stateDiagram-v2
    [*] --> Splash
    Splash --> Login : token inválido/ausente
    Splash --> RoteadorRole : token válido

    Login --> RoteadorRole : auth sucesso

    state RoteadorRole <<choice>>
    RoteadorRole --> TabsAluno : role = ALUNO
    RoteadorRole --> TabsPersonal : role = PERSONAL

    %% ── Fluxo Aluno ──────────────────────────────────────
    state TabsAluno {
        TreinoHoje --> ExecucaoTreino : "Iniciar Treino"
        TreinoHoje --> Historico : aba Histórico
        TreinoHoje --> PerfilAluno : aba Perfil

        ExecucaoTreino --> SerieAtiva : navega por exercício
        SerieAtiva --> RegistrarSerie : "Concluir Série"
        RegistrarSerie --> SerieAtiva : próxima série
        SerieAtiva --> ConcluirTreino : última série
        ConcluirTreino --> TreinoHoje : animação de conclusão

        Historico --> DetalheHistorico : toca na sessão
        PerfilAluno --> EvolucaoExercicio : gráficos de progresso
    }

    %% ── Fluxo Personal ───────────────────────────────────
    state TabsPersonal {
        DashboardPersonal --> DetalheAluno : toca no aluno
        DashboardPersonal --> Exercicios : aba Exercícios
        DashboardPersonal --> PerfilPersonal : aba Perfil

        Exercicios --> NovoExercicio : "+"
        NovoExercicio --> UploadMidia : seleciona vídeo/GIF
        UploadMidia --> NovoExercicio : mídia anexada
        NovoExercicio --> Exercicios : salva exercício

        DetalheAluno --> FichaAtiva : ver ficha
    }
```

### Estrutura de Pastas Mobile

O roteamento raiz detecta a role do token e monta o navigator correspondente.

```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (aluno)/                  # Navigator exclusivo do aluno
│   │   ├── _layout.tsx           # Bottom Tabs: Treino | Histórico | Perfil
│   │   ├── index.tsx             # Treino Hoje
│   │   ├── historico.tsx
│   │   └── perfil.tsx
│   ├── (personal)/               # Navigator exclusivo do personal
│   │   ├── _layout.tsx           # Bottom Tabs: Dashboard | Exercícios | Perfil
│   │   ├── index.tsx             # Dashboard (alunos, frequência)
│   │   ├── exercicios/
│   │   │   ├── index.tsx         # Listagem de exercícios
│   │   │   └── novo.tsx          # Formulário + upload de mídia
│   │   └── perfil.tsx
│   ├── treino/
│   │   └── [sessaoId].tsx        # Execução de treino fullscreen (aluno)
│   └── _layout.tsx               # Root: lê role do JWT, redireciona para (aluno) ou (personal)
│
├── features/
│   ├── treino/                   # [Aluno] execução de treino
│   │   ├── components/
│   │   │   ├── TreinoCard.tsx
│   │   │   ├── ExercicioItem.tsx
│   │   │   ├── SerieRow.tsx
│   │   │   └── ProgressRing.tsx  # Reanimated
│   │   ├── hooks/
│   │   │   ├── useTreinoHoje.ts
│   │   │   └── useRegistrarSerie.ts
│   │   └── index.ts
│   │
│   ├── historico/                # [Aluno] sessões passadas
│   │   ├── components/
│   │   │   ├── SessaoCard.tsx
│   │   │   └── SessaoDetalhe.tsx
│   │   ├── hooks/
│   │   │   └── useHistorico.ts
│   │   └── index.ts
│   │
│   ├── perfil-aluno/             # [Aluno] gráficos de evolução
│   │   ├── components/
│   │   │   └── EvolucaoChart.tsx
│   │   ├── hooks/
│   │   │   └── usePerfil.ts
│   │   └── index.ts
│   │
│   ├── exercicios-personal/      # [Personal] gestão de exercícios no mobile
│   │   ├── components/
│   │   │   ├── ExercicioCard.tsx
│   │   │   ├── ExercicioForm.tsx     # Nome, grupo muscular, observações
│   │   │   └── MidiaPickerField.tsx  # expo-image-picker + expo-document-picker
│   │   ├── hooks/
│   │   │   ├── useExercicios.ts
│   │   │   └── useCriarExercicio.ts  # multipart/form-data com upload de mídia
│   │   └── index.ts
│   │
│   └── dashboard-personal/       # [Personal] visão geral de alunos
│       ├── components/
│       │   ├── AlunosHojeCard.tsx
│       │   └── AlunoListItem.tsx
│       ├── hooks/
│       │   └── useDashboardPersonal.ts
│       └── index.ts
│
└── shared/
    ├── components/
    │   ├── Button.tsx
    │   ├── Input.tsx
    │   └── LoadingSkeleton.tsx
    ├── hooks/
    │   └── useAuth.ts            # expõe role para roteamento condicional
    └── lib/
        ├── api-client.ts
        └── query-client.ts
```

---

## 8. Estrutura do Monorepo

### Justificativa: Monorepo com pnpm Workspaces

**Prós do monorepo:**
- Pacote `@amfit/shared` com schemas Zod, tipos de API e constantes de domínio — único source of truth para web e mobile.
- Um único pipeline CI no Tekton — build, test e lint em paralelo por workspace.
- Alterações na API (ex: novo campo no `ExercicioResponse`) aparecem como erro de compilação TypeScript imediatamente no web e no mobile.

**Contras aceitos:**
- Build inicial do Go não participa do pnpm workspace — roda isolado em `apps/api/`.
- Tamanho do repositório cresce mais rápido; mitigado com `.gitignore` rigoroso e `turbo.json`.

**Tooling:** pnpm v9 + Turborepo para cache de builds e execução paralela.

### Layout de Pastas

```
amfit/
├── apps/
│   ├── api/                          # Backend Go
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── identity/             # Bounded Context
│   │   │   │   ├── domain/
│   │   │   │   ├── application/
│   │   │   │   ├── infrastructure/
│   │   │   │   └── handlers/
│   │   │   ├── catalog/
│   │   │   │   ├── domain/
│   │   │   │   ├── application/
│   │   │   │   ├── infrastructure/
│   │   │   │   └── handlers/
│   │   │   ├── training/
│   │   │   │   ├── domain/
│   │   │   │   ├── application/
│   │   │   │   ├── infrastructure/
│   │   │   │   └── handlers/
│   │   │   ├── execution/
│   │   │   │   ├── domain/
│   │   │   │   ├── application/
│   │   │   │   ├── infrastructure/
│   │   │   │   └── handlers/
│   │   │   └── progress/
│   │   │       ├── domain/
│   │   │       ├── application/
│   │   │       ├── infrastructure/
│   │   │       └── handlers/
│   │   ├── pkg/
│   │   │   ├── auth/                 # JWT sign/verify
│   │   │   ├── storage/              # MinIO client wrapper
│   │   │   ├── database/             # pgxpool, migrations
│   │   │   └── middleware/           # Fiber middlewares
│   │   ├── migrations/
│   │   │   ├── 000001_init.up.sql
│   │   │   ├── 000001_init.down.sql
│   │   │   └── ...
│   │   ├── go.mod
│   │   └── go.sum
│   │
│   ├── web/                          # Next.js (estrutura na seção 6)
│   │   ├── app/
│   │   ├── features/
│   │   ├── shared/
│   │   ├── styles/
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── mobile/                       # Expo (estrutura na seção 7)
│       ├── app/
│       ├── features/
│       ├── shared/
│       ├── package.json
│       └── app.config.ts
│
├── packages/
│   └── shared/                       # @amfit/shared
│       ├── src/
│       │   ├── schemas/              # Zod schemas espelhando OpenAPI
│       │   │   ├── auth.schema.ts
│       │   │   ├── aluno.schema.ts
│       │   │   ├── exercicio.schema.ts
│       │   │   ├── ficha.schema.ts
│       │   │   └── sessao.schema.ts
│       │   ├── types/                # Tipos inferidos dos schemas
│       │   │   └── index.ts
│       │   └── constants/
│       │       ├── grupos-musculares.ts
│       │       └── status.ts
│       ├── package.json
│       └── tsconfig.json
│
├── infra/
│   ├── k8s/                          # Manifestos Kubernetes
│   │   ├── namespace.yaml
│   │   ├── api/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── secret.yaml
│   │   │   └── ingress.yaml
│   │   ├── web/
│   │   │   ├── deployment.yaml
│   │   │   └── ingress.yaml
│   │   └── minio/
│   │       ├── statefulset.yaml      # Único storage a provisionar — não existe no shared-infra
│   │       ├── service.yaml
│   │       └── ingress.yaml
│   │   # NOTA: PostgreSQL e Redis NÃO estão aqui — usar serviços pré-existentes:
│   │   #   postgresql.shared-infra.svc.cluster.local:5432  (db: amfit, user: amfit)
│   │   #   redis.shared-infra.svc.cluster.local:6379
│   ├── argocd/
│   │   └── application.yaml          # ArgoCD Application CR
│   └── tekton/
│       ├── pipeline-api.yaml
│       ├── pipeline-web.yaml
│       └── pipeline-mobile.yaml
│
├── docs/
│   ├── SDD.md                        # Este documento
│   └── openapi.yaml                  # OpenAPI spec completa
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── .gitignore
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/web"
  - "apps/mobile"
  - "packages/*"
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 9. Infraestrutura K3s (Self-Hosting)

### Alocação de Workloads por Nó

| Workload | Nó | Tipo | Justificativa |
|---|---|---|---|
| AMFIT API (Go) | k3s-worker-cicd (192.168.1.31) | Novo deploy | CPU + RAM adequados, label workload=cicd |
| Next.js Web | k3s-worker-cicd (192.168.1.31) | Novo deploy | Mesmo nó, SSR é I/O-bound |
| MinIO | k3s-worker-cicd (192.168.1.31) | Novo deploy | StatefulSet com PVC local-path — único storage não pré-existente |
| **PostgreSQL 16** | **ubuntu-neto (192.168.1.65)** | **Pré-existente** | **Namespace `shared-infra` — banco `amfit` e usuário `amfit` já provisionados** |
| **Redis 7** | **ubuntu-neto (192.168.1.65)** | **Pré-existente** | **Namespace `shared-infra` — AOF + RDB habilitados, limit 200MB allkeys-lru** |
| Pipelines Tekton | k3s-worker-cicd (192.168.1.31) | Pré-existente | label workload=cicd |
| Build runners | ci-runner (192.168.1.32) | Pré-existente | Isolado do cluster principal |

**Nota:** Raspberry Pi (raspneto, ARMv7) não executa workloads AMFIT — limitação de RAM (1GB) e arquitetura arm32.

### Serviços de Dados Pré-existentes (shared-infra)

Os bancos de dados foram provisionados no namespace `shared-infra` como parte da infraestrutura compartilhada do lab. O AMFIT **não deve criar novos StatefulSets** para PostgreSQL ou Redis — consumir os existentes via service DNS interno.

| Serviço | Host (in-cluster) | Porta | Credenciais | Observações |
|---|---|---|---|---|
| PostgreSQL 16 | `postgresql.shared-infra.svc.cluster.local` | `5432` | user: `amfit` / db: `amfit` | Banco e usuário já criados no init script |
| Redis 7 | `redis.shared-infra.svc.cluster.local` | `6379` | senha via Secret | AOF persistence habilitado |

> As credenciais do PostgreSQL e Redis estão nos Secrets do namespace `shared-infra`. Para o namespace `amfit` consumi-las, criar um Secret local referenciando os valores ou usar um ExternalSecret (se Vault/SOPS estiver configurado).

### Ingress (Traefik)

```
https://api.amfit.local    → Service: amfit-api:8080
https://app.amfit.local    → Service: amfit-web:3000
https://minio.amfit.local  → Service: minio:9001 (console)
```

### Manifesto de exemplo — API Deployment

```yaml
# infra/k8s/api/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: amfit-api
  namespace: amfit
spec:
  replicas: 2
  selector:
    matchLabels:
      app: amfit-api
  template:
    metadata:
      labels:
        app: amfit-api
    spec:
      nodeSelector:
        workload: cicd
      containers:
        - name: api
          image: harbor.lab.local/amfit/api:latest
          ports:
            - containerPort: 8080
          env:
            # PostgreSQL pré-existente — namespace shared-infra
            - name: DATABASE_URL
              value: "postgres://amfit:$(PG_PASSWORD)@postgresql.shared-infra.svc.cluster.local:5432/amfit?sslmode=disable"
            - name: PG_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: amfit-secrets
                  key: pg-password
            # Redis pré-existente — namespace shared-infra
            - name: REDIS_URL
              value: "redis://:$(REDIS_PASSWORD)@redis.shared-infra.svc.cluster.local:6379/0"
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: amfit-secrets
                  key: redis-password
            # MinIO deployado no namespace amfit
            - name: MINIO_ENDPOINT
              value: "minio.amfit.svc.cluster.local:9000"
            - name: MINIO_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: amfit-secrets
                  key: minio-access-key
            - name: MINIO_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: amfit-secrets
                  key: minio-secret-key
            - name: JWT_PRIVATE_KEY
              valueFrom:
                secretKeyRef:
                  name: amfit-secrets
                  key: jwt-private-key
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
```

### Secret — amfit-secrets

```yaml
# infra/k8s/api/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: amfit-secrets
  namespace: amfit
type: Opaque
stringData:
  # Referenciar as credenciais dos bancos pré-existentes do shared-infra
  pg-password: "amfit123!"
  redis-password: "redis123!"
  minio-access-key: "amfit-minio"
  minio-secret-key: "<gerar-na-criacao>"
  jwt-private-key: "<chave-RS256-privada>"
```

> Em produção substituir por SOPS ou Sealed Secrets. Para o lab, o Secret em texto plano é aceitável desde que o repositório seja privado.

---

## 10. Observabilidade

Alinhado ao stack existente no infra-lab (kube-prometheus-stack + Loki + Grafana):

| Pilar | Implementação |
|---|---|
| Logs | Zerolog (Go) — JSON estruturado com `trace_id`, `user_id`. Loki via Promtail |
| Tracing | OpenTelemetry SDK Go → Tempo (já no infra-lab) |
| Metrics | Prometheus client Go — endpoints RED por handler Fiber |

### SLOs do MVP

| Indicador (SLI) | Objetivo (SLO) |
|---|---|
| Latência p99 GET /alunos/me/treino-hoje | < 200ms em 99% das req/30d |
| Latência p99 PATCH /sessoes/{id}/series | < 150ms em 99% das req/30d |
| Disponibilidade da API | >= 99.5%/mês (22min downtime permitido) |
| Upload de mídia (POST /exercicios) | < 5s p95 para arquivos até 10MB |

---

## 11. Estratégias de Resiliência

### Circuit Breaker (API → PostgreSQL)

- Biblioteca: `github.com/sony/gobreaker`
- Threshold: 5 falhas consecutivas em 10s
- Timeout de recuperação: 30s
- Fallback: resposta 503 com `Retry-After: 30`

### Retry (API → MinIO)

- Tentativas: 3
- Backoff: exponencial 500ms, 1s, 2s + jitter ±20%
- Não aplica retry em 4xx (arquivo corrompido, permissão)
- Timeout global de upload: 60s

### Cache Redis

| Dado | TTL | Estratégia |
|---|---|---|
| Ficha ativa do aluno | 5min | Cache-aside; invalidar ao salvar nova ficha |
| Lista de exercícios globais | 1h | Cache-aside; invalidar ao criar/editar exercício |
| Dashboard do personal | 2min | Cache-aside; invalidar ao registrar sessão |

---

## 12. Roadmap de Implementação

### Fase 0 — Fundação (Semana 1-2)

| Entregável | Responsável |
|---|---|
| Setup monorepo (pnpm + Turborepo + Go workspace) | Backend |
| Namespace K8s, secrets, PostgreSQL StatefulSet, MinIO | DevOps |
| Migrations iniciais (tabelas core do ERD) | Backend |
| Pipeline Tekton: build API + web | DevOps |
| ArgoCD Application CR apuntando para `infra/k8s/` | DevOps |
| Pacote `@amfit/shared` com schemas Zod base | Frontend |

### Fase 1 — MVP Core (Semana 3-6)

| Entregável | Contexto |
|---|---|
| Auth completo (login, refresh, logout) — Personal + Aluno | Identity |
| CRUD de alunos (Personal) — portal web | Identity |
| CRUD de exercícios com upload de mídia — portal web | Catalog |
| Cadastro de exercícios com upload de mídia — **app mobile (Personal)** | Catalog |
| Montagem de fichas de treino (A/B/C) — portal web | Training |
| App mobile: roteamento por role (Aluno / Personal) | Identity |
| App mobile: tela de login | Identity |
| App mobile [Aluno]: treino do dia + execução de séries | Execution |
| App mobile [Aluno]: registrar séries com carga | Execution |
| App mobile [Personal]: dashboard básico + lista de exercícios | Progress |
| Dashboard básico do personal (alunos treinaram hoje) — portal web | Progress |

### Fase 2 — Experiência Completa (Semana 7-10)

| Entregável | Contexto |
|---|---|
| Histórico de sessões — mobile + web | Execution |
| Gráficos de evolução de carga por exercício | Progress |
| Medidas corporais (cadastro + histórico) | Progress |
| Notificações push (aluno sem treinar há N dias) | Identity |
| Rotação automática de treino A/B/C | Training |
| Duplicar/reaproveitar fichas de treino | Training |
| Busca full-text em exercícios | Catalog |

### Fase 3 — Polimento e Expansão (Semana 11-14)

| Entregável | Contexto |
|---|---|
| Dark mode (web + mobile) | — |
| Relatório PDF de evolução do aluno | Progress |
| Compartilhamento de exercícios entre personals | Catalog |
| Planos de assinatura / billing (multi-tenant) | Identity |
| Exportação de dados (LGPD) | Identity |
| Testes E2E web (Playwright) e mobile (Detox) | QA |

### Fase 4 — V2 (pós-MVP)

| Entregável |
|---|
| Vídeo demonstrativo de exercício no app (HLS streaming via MinIO) |
| Temporizador de descanso com vibração (expo-haptics) |
| Integração com balança Bluetooth (bare workflow) |
| Modo offline com sync (WatermelonDB) |
| App mobile [Personal]: montagem de fichas de treino diretamente no mobile |

---

## 13. Bounded Contexts Expandidos

### Mapa de Contextos Atualizado

```mermaid
flowchart TD
    subgraph Identity["Identity Context"]
        PT[PersonalTrainer]
        AL[Aluno]
        AUTH[Credenciais]
    end

    subgraph Catalog["Catalog Context"]
        EX[Exercicio]
        GM[GrupoMuscular]
        MD[Midia]
    end

    subgraph Training["Training Context"]
        FT[FichaTreino]
        TR[Treino A/B/C]
        IT[ItemTreino]
    end

    subgraph Execution["Execution Context"]
        SE[SessaoTreino]
        RS[RegistroSerie]
    end

    subgraph Progress["Progress Context"]
        EV[Evolucao]
        MED[Medidas]
        DASH[Dashboard]
        FE[FotoEvolucao]
        RP[RecordPessoal]
    end

    subgraph Financial["Financial Context"]
        PL[PlanoAluno]
        MN[Mensalidade]
        LP[LinkPagamento]
    end

    subgraph Notification["Notification Context"]
        NT[Notificacao]
        PK[PushToken]
        JB[JobAgendado]
    end

    subgraph Chat["Chat Context"]
        CN[Canal]
        MG[Mensagem]
        PR[Presenca]
    end

    subgraph Gamification["Gamification Context"]
        BG[Badge]
        AB[AlunoBadge]
        RK[Ranking]
    end

    Identity -->|ACL: personal_id / aluno_id| Training
    Identity -->|ACL: aluno_id| Financial
    Identity -->|ACL: aluno_id + personal_id| Chat
    Catalog -->|Open Host: exercicio_id| Training
    Training -->|Open Host: ficha_id| Execution
    Execution -->|Domain Event: sessao.concluida| Progress
    Execution -->|Domain Event: sessao.concluida| Notification
    Execution -->|Domain Event: sessao.concluida| Gamification
    Progress -->|Domain Event: record_pessoal.batido| Notification
    Progress -->|Domain Event: record_pessoal.batido| Gamification
    Financial -->|Domain Event: mensalidade.vencendo| Notification
    Financial -->|Domain Event: mensalidade.paga| Notification
    Identity -->|Open Host: aluno_id| Progress
    Identity -->|Open Host: aluno_id| Gamification
```

---

### 13.1 Financial Context

**Responsabilidade:** controlar o relacionamento financeiro entre o personal e cada aluno — plano contratado, cobranças mensais, geração de links de pagamento e status dos recebimentos.

**Ubiquitous Language:**
- `PlanoAluno`: configuração do contrato vigente (valor mensal, dia de vencimento, data de início/fim).
- `Mensalidade`: cobrança individual de um mês de competência. Entidade central do contexto.
- `LinkPagamento`: URL gerada pelo gateway para um pagamento avulso, com status de ciclo de vida próprio.
- `Competência`: par (ano, mês) que identifica unicamente uma mensalidade dentro de um plano.

**Aggregates e Entidades:**

| Aggregate Root | Entidades Filhas | Value Objects |
|---|---|---|
| `PlanoAluno` | — | `Vigencia(inicio, fim)`, `ValorMensal` |
| `Mensalidade` | `LinkPagamento` | `Competencia(ano, mes)`, `StatusMensalidade` |

**Eventos de Domínio Emitidos:**

| Evento | Quando | Consumidores |
|---|---|---|
| `mensalidade.gerada` | Job cria nova mensalidade no vencimento | Notification |
| `mensalidade.vencendo` | D-3, D-1 e dia do vencimento | Notification |
| `mensalidade.paga` | Webhook do gateway confirma pagamento | Notification |
| `mensalidade.atrasada` | Status muda para ATRASADA após vencimento | Notification |
| `link_pagamento.expirado` | TTL do link alcançado sem pagamento | — |

**Relação com outros contextos:**
- Consome `aluno_id` do Identity Context via referência (não importa a entidade `Aluno`).
- Não acessa diretamente Training ou Execution — isola responsabilidade financeira do domínio de treino.

---

### 13.2 Notification Context

**Responsabilidade:** entregar notificações push para dispositivos móveis e registrar tokens Expo Push. Orquestra os lembretes automáticos de mensalidade e as notificações reativas a eventos do domínio de execução e progresso.

**Ubiquitous Language:**
- `PushToken`: token gerado pelo Expo SDK no dispositivo, registrado no backend ao fazer login.
- `Notificacao`: registro persistido de uma notificação enviada (para histórico e auditoria).
- `JobAgendado`: tarefa cron que verifica condições de disparo (ex: mensalidades vencendo).

**Aggregates e Entidades:**

| Aggregate Root | Entidades Filhas | Value Objects |
|---|---|---|
| `PushToken` | — | `PlataformaDispositivo(ANDROID, IOS)` |
| `Notificacao` | — | `TipoNotificacao`, `StatusEntrega` |

**Eventos Consumidos:**

| Evento (Origem) | Ação no contexto |
|---|---|
| `sessao.concluida` (Execution) | Notifica personal: "Aluno X concluiu treino" |
| `record_pessoal.batido` (Progress) | Notifica personal e aluno: "Novo PR em Supino!" |
| `mensalidade.vencendo` (Financial) | Notifica aluno com link de pagamento |
| `mensalidade.paga` (Financial) | Notifica personal: pagamento confirmado |
| `mensalidade.atrasada` (Financial) | Notifica aluno: mensalidade em atraso |

**Integração:**
- Utiliza Expo Push Notification Service como único ponto de saída — o backend nunca se conecta diretamente ao FCM ou APNs.
- Personal e aluno devem ter `push_token` registrado; notificação é silenciosa se não houver token.

---

### 13.3 Chat Context

**Responsabilidade:** canal de mensagem direta entre aluno e seu personal. Comunicação bidirecional, assíncrona, com confirmação de leitura. Completamente self-hosted sobre WebSocket.

**Ubiquitous Language:**
- `Canal`: par (aluno_id, personal_id) que define o escopo da conversa. Cada aluno tem exatamente um canal com seu personal.
- `Mensagem`: unidade de comunicação com remetente, conteúdo textual, timestamp e flag `lida`.
- `Presenca`: estado online/offline de um participante no canal, mantido via WebSocket.

**Aggregates e Entidades:**

| Aggregate Root | Entidades Filhas | Value Objects |
|---|---|---|
| `Canal` | `Mensagem` | `ParticipanteId(tipo, id)` |

**Invariantes do Aggregate:**
- Um canal pertence a exatamente um par aluno-personal.
- Apenas os dois participantes do canal podem ler e escrever mensagens.
- O personal pode ter múltiplos canais (um por aluno); o aluno tem exatamente um canal.

**Eventos de Domínio Emitidos:**

| Evento | Consumidores |
|---|---|
| `mensagem.recebida` | Notification (push se destinatário offline) |

**Relação com outros contextos:**
- Consome `aluno_id` e `personal_id` do Identity Context para autorizar acesso ao canal.
- Não depende de Training, Financial nem Gamification.

---

### 13.4 Gamification Context

**Responsabilidade:** registrar conquistas dos alunos (badges), calcular rankings por personal e detectar marcos de frequência e performance.

**Ubiquitous Language:**
- `Badge`: definição de uma conquista (nome, ícone, critério mensurável). Imutável após criação.
- `AlunoBadge`: instância de um badge desbloqueado por um aluno em uma data específica.
- `Ranking`: tabela ordenada de alunos por pontuação dentro do escopo de um personal, em um período definido.
- `Pontuacao`: valor calculado com base em sessões concluídas, PRs batidos e constância.

**Aggregates e Entidades:**

| Aggregate Root | Entidades Filhas | Value Objects |
|---|---|---|
| `Badge` | — | `CriterioBadge`, `IconeBadge` |
| `AlunoBadge` | — | `DataDesbloqueio` |
| `Ranking` | `EntradaRanking` | `PeriodoRanking(ano, semana/mes)`, `Pontuacao` |

**Eventos Consumidos:**

| Evento (Origem) | Avaliação no contexto |
|---|---|
| `sessao.concluida` (Execution) | Incrementa contadores de frequência; verifica badges de constância |
| `record_pessoal.batido` (Progress) | Incrementa contador de PRs; verifica badge "Quebrando Limites" |

**Relação com outros contextos:**
- Consome `aluno_id` e `personal_id` do Identity Context para escopo do ranking.
- Lê dados agregados de Execution e Progress via queries diretas ao banco (mesma instância PostgreSQL, bounded pelo `personal_id`); não consome eventos em tempo real para o ranking — recalcula periodicamente via job.

---

## 14. Modelagem de Dados — Novos Contextos

### ERD — Financial Context

```mermaid
erDiagram
    PLANO_ALUNO {
        uuid id PK
        uuid aluno_id FK "not null"
        uuid personal_id FK "not null"
        decimal valor_mensal "precision 10,2 — not null"
        int dia_vencimento "1-28, not null"
        date vigencia_inicio "not null"
        date vigencia_fim "nullable — null = indeterminado"
        enum status "ATIVO|SUSPENSO|ENCERRADO"
        string observacao "nullable"
        timestamp criado_em "default now()"
        timestamp atualizado_em
    }

    MENSALIDADE {
        uuid id PK
        uuid plano_id FK "not null"
        uuid aluno_id FK "not null — desnormalizado para queries diretas"
        int competencia_ano "not null"
        int competencia_mes "1-12, not null"
        date data_vencimento "not null"
        decimal valor "precision 10,2 — not null"
        enum status "PENDENTE|PAGA|ATRASADA|CANCELADA|ISENTA"
        decimal valor_pago "nullable"
        date data_pagamento "nullable"
        string forma_pagamento "nullable — PIX|BOLETO|CARTAO|DINHEIRO"
        string observacao "nullable"
        timestamp criado_em
        timestamp atualizado_em
    }

    LINK_PAGAMENTO {
        uuid id PK
        uuid mensalidade_id FK "not null"
        string gateway "ASAAS|MERCADOPAGO|PAGARMEE"
        string gateway_charge_id "ID externo do gateway — UK"
        string url "URL do link de pagamento — not null"
        enum status "PENDENTE|PAGO|EXPIRADO|CANCELADO"
        timestamp expira_em "nullable"
        jsonb metadata "payload bruto do webhook — nullable"
        timestamp criado_em
        timestamp atualizado_em
    }

    PLANO_ALUNO ||--o{ MENSALIDADE : "gera"
    MENSALIDADE ||--o{ LINK_PAGAMENTO : "possui"
```

### ERD — Identity Context (ampliado com Anamnese)

```mermaid
erDiagram
    ALUNO {
        uuid id PK
        uuid personal_id FK
        string nome "not null"
        string email UK "not null"
        date data_nascimento
        enum sexo "M|F|OUTRO"
        string telefone
        enum nivel_atividade "SEDENTARIO|LEVE|MODERADO|INTENSO|ATLETA"
        boolean ativo "default true"
        timestamp criado_em
        timestamp atualizado_em
    }

    ANAMNESE {
        uuid id PK
        uuid aluno_id FK "not null — UK (um por aluno)"
        text objetivo "não null — ex: hipertrofia, emagrecimento"
        text lesoes "nullable — lista de lesões/restrições"
        text doencas_preexistentes "nullable"
        text medicamentos "nullable"
        boolean pratica_outro_esporte "default false"
        text outro_esporte "nullable"
        int frequencia_semanas_anterior "nullable — qts dias/sem treinava antes"
        text observacoes_gerais "nullable"
        timestamp preenchido_em "not null"
        timestamp atualizado_em
    }

    ALUNO ||--o| ANAMNESE : "possui"
```

### ERD — Progress Context (ampliado)

```mermaid
erDiagram
    FOTO_EVOLUCAO {
        uuid id PK
        uuid aluno_id FK "not null"
        string bucket "evolucao/ — MinIO bucket privado"
        string object_key "caminho no bucket — not null"
        enum angulo "FRONTAL|LATERAL_ESQUERDO|LATERAL_DIREITO|COSTAS"
        date data_foto "not null"
        decimal peso_na_data "nullable — kg"
        string tags "nullable — ex: 3meses, corte"
        timestamp criado_em
    }

    RECORD_PESSOAL {
        uuid id PK
        uuid aluno_id FK "not null"
        uuid exercicio_id FK "not null"
        decimal carga_maxima "precision 6,2 — kg, not null"
        int repeticoes_na_carga "nullable"
        uuid sessao_id FK "sessao onde o PR foi atingido"
        uuid registro_serie_id FK "série específica que gerou o PR"
        date data_record "not null"
        timestamp criado_em
    }

    ALUNO ||--o{ FOTO_EVOLUCAO : "registra"
    ALUNO ||--o{ RECORD_PESSOAL : "acumula"
```

### ERD — Notification Context

```mermaid
erDiagram
    PUSH_TOKEN {
        uuid id PK
        uuid owner_id "user_id — personal ou aluno"
        enum owner_type "PERSONAL|ALUNO"
        string token "token Expo Push — not null"
        enum plataforma "ANDROID|IOS"
        boolean ativo "default true"
        timestamp registrado_em
        timestamp atualizado_em
    }

    NOTIFICACAO {
        uuid id PK
        uuid destinatario_id "owner_id"
        enum destinatario_tipo "PERSONAL|ALUNO"
        string titulo "not null"
        string corpo "not null"
        string tipo "TREINO_CONCLUIDO|PR_BATIDO|MENSALIDADE_VENCENDO|MENSALIDADE_PAGA|MENSAGEM_RECEBIDA|BADGE_DESBLOQUEADO"
        jsonb dados_extras "nullable — link_pagamento_url, badge_id, etc."
        enum status "PENDENTE|ENVIADA|ERRO"
        string erro_detalhe "nullable"
        timestamp criado_em
        timestamp enviado_em "nullable"
    }
```

### ERD — Chat Context

```mermaid
erDiagram
    CANAL_CHAT {
        uuid id PK
        uuid aluno_id FK "not null"
        uuid personal_id FK "not null"
        timestamp ultima_mensagem_em "nullable — para ordenação de lista"
        timestamp criado_em
    }

    MENSAGEM {
        uuid id PK
        uuid canal_id FK "not null"
        uuid remetente_id "not null — aluno_id ou personal_id"
        enum remetente_tipo "ALUNO|PERSONAL"
        text conteudo "not null"
        boolean lida "default false"
        timestamp lida_em "nullable"
        timestamp enviado_em "default now()"
        timestamp deletado_em "nullable — soft delete"
    }

    CANAL_CHAT ||--|{ MENSAGEM : "contém"
```

### ERD — Gamification Context

```mermaid
erDiagram
    BADGE {
        uuid id PK
        string nome UK "not null"
        string descricao "not null"
        string icone_url "MinIO — bucket badges — public"
        string criterio_tipo "CONSTANCIA_DIAS|TOTAL_SESSOES|TOTAL_PR|PRIMEIRO_TREINO|MARATONA_SEMANAL"
        int criterio_valor "valor numérico do critério — ex: 7 para 7 dias seguidos"
        boolean ativo "default true"
        timestamp criado_em
    }

    ALUNO_BADGE {
        uuid id PK
        uuid aluno_id FK "not null"
        uuid badge_id FK "not null"
        uuid sessao_id FK "nullable — sessão que disparou o desbloqueio"
        timestamp desbloqueado_em "not null"
    }

    RANKING_SEMANAL {
        uuid id PK
        uuid personal_id FK "not null"
        int ano "not null"
        int semana_iso "1-53, not null"
        uuid aluno_id FK "not null"
        int pontuacao "not null"
        int posicao "calculado no fechamento da semana"
        int sessoes_semana "not null"
        int prs_semana "not null"
        timestamp calculado_em
    }

    BADGE ||--o{ ALUNO_BADGE : "desbloqueado por"
```

### Índices Críticos — Novos Contextos

```sql
-- Financial: mensalidades por aluno e status (tela de cobranças)
CREATE INDEX idx_mensalidade_aluno_status
    ON mensalidade(aluno_id, status, data_vencimento DESC);

-- Financial: mensalidades pendentes/atrasadas por personal (dashboard)
CREATE INDEX idx_mensalidade_plano_status
    ON mensalidade(plano_id, status)
    WHERE status IN ('PENDENTE', 'ATRASADA');

-- Financial: unicidade competência por plano
CREATE UNIQUE INDEX uq_mensalidade_competencia
    ON mensalidade(plano_id, competencia_ano, competencia_mes);

-- Chat: mensagens por canal em ordem cronológica (paginação do histórico)
CREATE INDEX idx_mensagem_canal_enviado
    ON mensagem(canal_id, enviado_em DESC)
    WHERE deletado_em IS NULL;

-- Chat: mensagens não lidas por destinatário (badge de notificação)
CREATE INDEX idx_mensagem_nao_lida
    ON mensagem(canal_id, lida)
    WHERE lida = false AND deletado_em IS NULL;

-- Chat: canal por par aluno-personal (unicidade e busca rápida)
CREATE UNIQUE INDEX uq_canal_chat_par
    ON canal_chat(aluno_id, personal_id);

-- Gamification: record pessoal por aluno e exercício (lookup na série)
CREATE UNIQUE INDEX uq_record_pessoal
    ON record_pessoal(aluno_id, exercicio_id);

-- Gamification: ranking semanal por personal e semana
CREATE INDEX idx_ranking_personal_semana
    ON ranking_semanal(personal_id, ano DESC, semana_iso DESC);

-- Notification: tokens ativos por owner
CREATE INDEX idx_push_token_owner
    ON push_token(owner_id, owner_type)
    WHERE ativo = true;

-- Progress: fotos por aluno em ordem cronológica
CREATE INDEX idx_foto_evolucao_aluno
    ON foto_evolucao(aluno_id, data_foto DESC);
```

---

## 15. Arquitetura de Real-time

### Decisão de Protocolo

| Requisito | Protocolo escolhido | Justificativa |
|---|---|---|
| Chat aluno ↔ personal | **WebSocket** | Bidirecional, baixa latência; o cliente envia e recebe na mesma conexão |
| Notificação de treino concluído (personal ← plataforma) | **SSE** | Unidirecional servidor → cliente; mais simples que WebSocket, sem necessidade de bidirecionalidade |
| Notificação de PR batido (personal ← plataforma) | **SSE** | Mesmo canal SSE de notificações gerais |
| Notificação de mensagem (fallback se WebSocket offline) | **Expo Push** | Push nativo via Expo Push Notification Service para dispositivos em background |

**Por que não polling:** O portal web do personal acompanha em tempo real múltiplos alunos treinando simultaneamente. Polling de 5s em 30 alunos ativos geraria 6 req/s por personal — desnecessário para o hardware do infra-lab. SSE mantém uma conexão persistente e entrega eventos sob demanda.

**Por que não Firebase/Pusher:** Restrição explícita de self-hosting. O backend Go/Fiber suporta WebSocket nativamente via `github.com/gofiber/websocket` e SSE via response streaming. O Redis Pub/Sub (já presente no stack) serve como broker interno entre goroutines e instâncias da API.

### Arquitetura Interna: Redis Pub/Sub como Broker

```mermaid
flowchart TD
    subgraph "API Instance 1"
        H1[Handler: PATCH /sessoes concluir]
        PUB1[Redis Publisher]
        SSE1[SSE Hub — Personal connections]
        WS1[WebSocket Hub — Chat connections]
    end

    subgraph "API Instance 2"
        SSE2[SSE Hub — Personal connections]
        WS2[WebSocket Hub — Chat connections]
    end

    subgraph "Redis"
        CH_NOTIF[Channel: notif:{personal_id}]
        CH_CHAT[Channel: chat:{canal_id}]
    end

    H1 -->|Publish evento| PUB1
    PUB1 -->|PUBLISH| CH_NOTIF
    CH_NOTIF -->|SUB| SSE1
    CH_NOTIF -->|SUB| SSE2
    WS1 -->|PUBLISH mensagem| CH_CHAT
    CH_CHAT -->|SUB| WS1
    CH_CHAT -->|SUB| WS2
```

**Justificativa do Redis como broker interno:** Em um deployment com 2 réplicas da API (conforme o manifesto K8s), um evento gerado na instância 1 precisa alcançar conexões SSE/WebSocket mantidas na instância 2. O Redis Pub/Sub (já no stack para cache) resolve isso sem introduzir nova dependência de infraestrutura.

### Diagrama de Sequência — Fluxo de Chat

```mermaid
sequenceDiagram
    participant AL as Aluno (App Mobile)
    participant API_WS as AMFIT API (WebSocket Hub)
    participant REDIS as Redis Pub/Sub
    participant API_PT as AMFIT API (SSE/WS Hub 2)
    participant PT as Personal (Web Admin)

    Note over AL,PT: Estabelecimento de conexão

    AL->>API_WS: WS CONNECT /ws/chat?token=JWT
    API_WS->>API_WS: Valida JWT, extrai canal_id = (aluno_id, personal_id)
    API_WS->>REDIS: SUBSCRIBE chat:{canal_id}
    API_WS-->>AL: 101 Switching Protocols

    PT->>API_PT: WS CONNECT /ws/chat?token=JWT
    API_PT->>API_PT: Valida JWT, extrai canal_id
    API_PT->>REDIS: SUBSCRIBE chat:{canal_id}
    API_PT-->>PT: 101 Switching Protocols

    Note over AL,PT: Aluno envia mensagem

    AL->>API_WS: WS SEND {"conteudo": "Qual peso no supino hoje?"}
    API_WS->>API_WS: Persiste mensagem no PostgreSQL (INSERT mensagem)
    API_WS->>REDIS: PUBLISH chat:{canal_id} {mensagem_id, conteudo, remetente, enviado_em}
    REDIS-->>API_WS: SUB event
    REDIS-->>API_PT: SUB event
    API_WS-->>AL: WS SEND {mensagem_id, conteudo, status: "entregue"}
    API_PT-->>PT: WS SEND {mensagem_id, conteudo, remetente: "ALUNO", enviado_em}

    Note over AL,PT: Personal confirma leitura

    PT->>API_PT: WS SEND {"tipo": "lida", "mensagem_id": "..."}
    API_PT->>API_PT: UPDATE mensagem SET lida=true, lida_em=now()
    API_PT->>REDIS: PUBLISH chat:{canal_id} {tipo: "lida", mensagem_id}
    REDIS-->>API_WS: SUB event
    API_WS-->>AL: WS SEND {tipo: "lida", mensagem_id}

    Note over AL,API_WS: Aluno offline — fallback push

    AL->>AL: App vai para background
    API_WS->>API_WS: Detecta desconexão WebSocket do aluno
    PT->>API_PT: WS SEND {"conteudo": "Use 40kg, foco em 12 reps"}
    API_PT->>API_PT: Persiste mensagem; aluno não conectado via WS
    API_PT->>API_PT: Emite evento mensagem.recebida
    API_PT->>API_PT: Notification Context: busca push_token do aluno
    API_PT->>API_PT: Chama Expo Push API (HTTPS)
    API_PT-->>AL: Push Notification: "Personal: Use 40kg, foco em 12 reps"
```

### Diagrama de Sequência — Fluxo de Notificação de PR

```mermaid
sequenceDiagram
    participant AL as Aluno (App Mobile)
    participant API as AMFIT API
    participant PG as PostgreSQL
    participant REDIS as Redis Pub/Sub
    participant SSE_HUB as SSE Hub (Personal)
    participant PT as Personal (Web Admin)
    participant EXPO as Expo Push API

    AL->>API: PATCH /sessoes/{id}/series {carga_realizada: 120, item_treino_id: "..."}
    API->>PG: INSERT registro_serie (carga_realizada=120)
    API->>PG: SELECT MAX(carga_realizada) FROM record_pessoal WHERE aluno_id=? AND exercicio_id=?
    PG-->>API: carga_anterior = 115

    Note over API: 120 > 115 — novo PR detectado

    API->>PG: UPSERT record_pessoal SET carga_maxima=120
    API->>PG: INSERT notificacao (tipo=PR_BATIDO, destinatario=personal_id)
    API->>REDIS: PUBLISH notif:{personal_id} {tipo: "PR_BATIDO", aluno: "João", exercicio: "Supino Reto", carga: 120}
    API-->>AL: 200 OK {record_pessoal: true, carga_maxima: 120}

    REDIS-->>SSE_HUB: SUB event

    alt Personal está com portal web aberto
        SSE_HUB-->>PT: SSE event: data: {"tipo":"PR_BATIDO","aluno":"João","exercicio":"Supino Reto","carga":120}
        PT->>PT: Toast notification no dashboard
    else Personal não está com portal aberto
        SSE_HUB->>SSE_HUB: Sem conexão SSE ativa para personal_id
        SSE_HUB->>PG: SELECT push_token WHERE owner_id=personal_id AND ativo=true
        PG-->>SSE_HUB: push_token
        SSE_HUB->>EXPO: POST https://exp.host/--/api/v2/push/send
        EXPO-->>PT: Push Notification: "João bateu PR! Supino Reto — 120kg"
    end
```

### Endpoints WebSocket e SSE

```
WS  /ws/chat          Autenticado — chat bidirecional aluno ↔ personal
SSE /events/notif     Autenticado — stream de notificações para personal e aluno
```

**Handshake de autenticação WebSocket:** O token JWT é passado como query parameter `?token=<jwt>` no momento da conexão (WebSocket não suporta headers customizados no handshake). O Hub valida o token antes de registrar a conexão; conexões com token inválido ou expirado são imediatamente fechadas com código 4001.

**Keep-alive:** O servidor envia um frame `ping` a cada 30s; clientes sem resposta após 10s são removidos do Hub.

**Reconexão no app mobile:** O cliente Expo implementa reconexão exponencial com backoff (1s, 2s, 4s, máx 30s) quando a conexão WebSocket cai (troca de rede, background no iOS).

---

## 16. Módulo Financeiro

### Decisão de Gateway de Pagamento

| Gateway | Pix | Boleto | Cartão | Links avulsos | Qualidade da API | Webhook | Custo/tx (aprox.) |
|---|---|---|---|---|---|---|---|
| **Asaas** | Sim | Sim | Sim | Sim (nativo) | REST bem documentada, sandbox robusto | Confiável, retry automático | 0,99% cartão; Pix e boleto com taxa fixa baixa |
| Pagar.me | Sim | Sim | Sim | Sim (payment_links) | REST madura, boa documentação | Confiável | ~2,49% cartão |
| Mercado Pago | Sim | Sim | Sim | Sim (preference) | REST ampla, mas complexa | Confiável | ~4,99% cartão (sem MDR negociado) |
| Stripe | Não (Pix em beta) | Não | Sim | Sim (payment_links) | Excelente | Excelente | ~3,4% + R$0,60/tx |

**Decisão: Asaas**

**Justificativa:**
1. **Links de cobrança avulsa** como conceito de primeira classe na API — endpoint `POST /payments` cria a cobrança e devolve `bankSlipUrl`, `pixQrCode` e `invoiceUrl` em um único request.
2. **Pix e boleto nativos** sem configuração adicional — adequado para o mercado do personal trainer brasileiro onde a maioria dos alunos paga via Pix.
3. **Webhook com retry automático** — Asaas tenta reenviar o evento por até 48h em caso de falha no endpoint receptor. Reduz a necessidade de reconciliação manual.
4. **Custo:** modelo de conta de pagamentos com taxa fixa baixa para Pix/boleto — mais previsível para personals com volume baixo-médio de cobranças.
5. **Sandbox gratuito** sem necessidade de aprovação — acelera desenvolvimento e testes de integração.

**Stripe foi descartado** pela ausência de Pix estável e boleto bancário nativo — meios de pagamento essenciais no contexto brasileiro do MVP.

### Fluxo Completo de Cobrança

```mermaid
sequenceDiagram
    participant PT as Personal (Web Admin)
    participant API as AMFIT API
    participant PG as PostgreSQL
    participant ASAAS as Asaas API
    participant AL as Aluno (App Mobile)
    participant NOTIF as Notification Worker

    Note over PT,AL: Personal configura plano do aluno

    PT->>API: POST /alunos/{id}/plano {valor: 200.00, dia_vencimento: 10}
    API->>PG: INSERT plano_aluno (valor=200, dia_vencimento=10, status=ATIVO)
    API-->>PT: 201 PlanoResponse

    Note over API,PG: Job mensal — geração automática de mensalidade

    API->>API: pg_cron: todo dia 1 às 08:00 — gera_mensalidades_do_mes()
    API->>PG: SELECT planos WHERE status=ATIVO AND dia_vencimento entre hoje e +30d
    PG-->>API: lista de planos
    API->>PG: INSERT mensalidade (competencia_ano, competencia_mes, data_vencimento, status=PENDENTE)
    API->>NOTIF: Emite mensalidade.gerada para cada mensalidade criada

    Note over PT,AL: Personal gera link de pagamento

    PT->>API: POST /mensalidades/{id}/link-pagamento
    API->>ASAAS: POST /payments {customer, dueDate, value, billingType: UNDEFINED}
    ASAAS-->>API: {id, bankSlipUrl, pixQrCode, invoiceUrl, status: PENDING}
    API->>PG: INSERT link_pagamento (gateway_charge_id, url, status=PENDENTE)
    API-->>PT: 201 {link_url, pix_qr_code, expira_em}
    PT->>AL: Envia link via chat ou WhatsApp externo

    Note over AL,ASAAS: Aluno efetua pagamento

    AL->>ASAAS: Paga via Pix/boleto
    ASAAS->>API: POST /webhooks/asaas {event: PAYMENT_RECEIVED, paymentId}
    API->>API: Valida assinatura HMAC do webhook
    API->>PG: UPDATE link_pagamento SET status=PAGO
    API->>PG: UPDATE mensalidade SET status=PAGA, data_pagamento=hoje, forma_pagamento=PIX
    API->>NOTIF: Emite mensalidade.paga
    NOTIF->>PG: SELECT push_token WHERE owner_id=personal_id
    NOTIF->>EXPO_API: Push: "João pagou a mensalidade de maio!"
    API-->>ASAAS: 200 OK
```

### Jobs Automáticos de Cobrança

A geração de mensalidades e os lembretes são controlados por dois mecanismos: `pg_cron` no PostgreSQL para triggers baseados em data, e um **worker Go** para os envios de notificação (que requerem acesso à Expo Push API e ao Redis).

```sql
-- Extensão pg_cron instalada no PostgreSQL
-- Ativar: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Geração de mensalidades
-- Executa todo dia 1 do mês às 07:00 (horário do servidor / UTC-3)
SELECT cron.schedule(
    'gerar-mensalidades-mensais',
    '0 10 1 * *',   -- 07:00 BRT = 10:00 UTC
    $$
    INSERT INTO mensalidade (id, plano_id, aluno_id, competencia_ano, competencia_mes, data_vencimento, valor, status)
    SELECT
        gen_random_uuid(),
        p.id,
        p.aluno_id,
        EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
        DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')
            + (p.dia_vencimento - 1) * INTERVAL '1 day',
        p.valor_mensal,
        'PENDENTE'
    FROM plano_aluno p
    WHERE p.status = 'ATIVO'
      AND NOT EXISTS (
          SELECT 1 FROM mensalidade m
          WHERE m.plano_id = p.id
            AND m.competencia_ano  = EXTRACT(YEAR  FROM (CURRENT_DATE + INTERVAL '1 month'))::int
            AND m.competencia_mes  = EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int
      );
    $$
);

-- Job 2: Marcar mensalidades como ATRASADA após vencimento
SELECT cron.schedule(
    'marcar-mensalidades-atrasadas',
    '0 11 * * *',   -- 08:00 BRT diariamente
    $$
    UPDATE mensalidade
    SET status = 'ATRASADA', atualizado_em = NOW()
    WHERE status = 'PENDENTE'
      AND data_vencimento < CURRENT_DATE;
    $$
);

-- Job 3: Inserir notificações de lembrete na tabela notificacao
-- O worker Go processa a tabela e dispara os pushes
SELECT cron.schedule(
    'lembretes-cobranca',
    '0 12 * * *',   -- 09:00 BRT diariamente
    $$
    INSERT INTO notificacao (id, destinatario_id, destinatario_tipo, titulo, corpo, tipo, dados_extras, status)
    SELECT
        gen_random_uuid(),
        m.aluno_id,
        'ALUNO',
        CASE
            WHEN m.data_vencimento = CURRENT_DATE + 3 THEN 'Sua mensalidade vence em 3 dias'
            WHEN m.data_vencimento = CURRENT_DATE + 1 THEN 'Sua mensalidade vence amanhã'
            WHEN m.data_vencimento = CURRENT_DATE     THEN 'Sua mensalidade vence hoje'
        END,
        CASE
            WHEN m.data_vencimento = CURRENT_DATE + 3 THEN 'Faltam 3 dias para o vencimento. Regularize para continuar treinando.'
            WHEN m.data_vencimento = CURRENT_DATE + 1 THEN 'Sua mensalidade vence amanhã. Não deixe para depois!'
            WHEN m.data_vencimento = CURRENT_DATE     THEN 'Hoje é o dia do vencimento da sua mensalidade.'
        END,
        'MENSALIDADE_VENCENDO',
        jsonb_build_object('mensalidade_id', m.id, 'valor', m.valor),
        'PENDENTE'
    FROM mensalidade m
    WHERE m.status = 'PENDENTE'
      AND m.data_vencimento IN (
          CURRENT_DATE + 3,
          CURRENT_DATE + 1,
          CURRENT_DATE
      )
      AND NOT EXISTS (
          SELECT 1 FROM notificacao n
          WHERE n.dados_extras->>'mensalidade_id' = m.id::text
            AND n.tipo = 'MENSALIDADE_VENCENDO'
            AND DATE(n.criado_em) = CURRENT_DATE
      );
    $$
);
```

**Worker Go — Notification Dispatcher:**

O worker é uma goroutine de background iniciada junto com a API. A cada 30 segundos faz polling na tabela `notificacao` por registros com `status = 'PENDENTE'`, busca os `push_token` dos destinatários e envia via Expo Push API em lotes (máximo 100 por request, conforme limite da Expo).

```go
// internal/notification/worker/dispatcher.go — estrutura conceitual

type Dispatcher struct {
    db         *pgxpool.Pool
    expoClient *expo.PushClient
    interval   time.Duration
}

func (d *Dispatcher) Run(ctx context.Context) {
    ticker := time.NewTicker(d.interval)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if err := d.processarPendentes(ctx); err != nil {
                slog.Error("notification dispatcher", "err", err)
            }
        }
    }
}
```

### Endpoints Financeiros Adicionais (fragmento OpenAPI)

```yaml
  /alunos/{id}/plano:
    post:
      tags: [Financeiro]
      summary: Configurar plano do aluno
      parameters:
        - $ref: "#/components/parameters/IdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CriarPlanoRequest"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlanoResponse"

  /mensalidades:
    get:
      tags: [Financeiro]
      summary: Listar mensalidades (filtro por status, competência, aluno)
      parameters:
        - name: aluno_id
          in: query
          schema: { type: string, format: uuid }
        - name: status
          in: query
          schema: { type: string, enum: [PENDENTE, PAGA, ATRASADA, CANCELADA, ISENTA] }
        - name: competencia_ano
          in: query
          schema: { type: integer }
        - name: competencia_mes
          in: query
          schema: { type: integer, minimum: 1, maximum: 12 }
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MensalidadeListResponse"

  /mensalidades/{id}/link-pagamento:
    post:
      tags: [Financeiro]
      summary: Gerar link de pagamento via Asaas
      parameters:
        - $ref: "#/components/parameters/IdParam"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LinkPagamentoResponse"

  /webhooks/asaas:
    post:
      tags: [Webhooks]
      summary: Receptor de eventos do gateway Asaas
      security: []
      description: |
        Valida assinatura HMAC-SHA256 no header X-Asaas-Signature.
        Processa eventos: PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                event:     { type: string }
                payment:
                  type: object
                  properties:
                    id:     { type: string }
                    status: { type: string }
      responses:
        "200":
          description: Evento processado
```

---

## 17. Gamificação — Regras de Negócio

### Catálogo de Badges (MVP)

| Badge | Criterio Tipo | Critério Valor | Descrição |
|---|---|---|---|
| Primeira Chegada | `PRIMEIRO_TREINO` | 1 | Primeira sessão concluída na plataforma |
| Na Ativa | `TOTAL_SESSOES` | 10 | 10 sessões concluídas (cumulativo) |
| Constante | `CONSTANCIA_DIAS` | 7 | 7 dias seguidos com ao menos 1 sessão concluída |
| Maratonista | `CONSTANCIA_DIAS` | 30 | 30 dias seguidos com ao menos 1 sessão |
| Quebrando Limites | `TOTAL_PR` | 1 | Primeiro recorde pessoal registrado |
| Máquina de PR | `TOTAL_PR` | 10 | 10 recordes pessoais acumulados |
| Dedicação Total | `TOTAL_SESSOES` | 50 | 50 sessões concluídas |
| Maratona Semanal | `MARATONA_SEMANAL` | 5 | 5 sessões em uma única semana ISO |

### Detecção de Desbloqueio

A detecção segue o modelo **event-driven para badges em tempo real** e **cron para badges de contagem acumulada**.

#### Badges detectados em tempo real (no handler da API)

Ao concluir uma sessão (`PATCH /sessoes/{id}/concluir`), o use case de conclusão delega ao serviço de gamificação a verificação dos badges aplicáveis:

```go
// internal/gamification/application/verificar_badges.go — estrutura conceitual

type VerificarBadgesInput struct {
    AlunoID   string
    SessaoID  string
    Contexto  ContextoDisparo // SESSAO_CONCLUIDA | PR_BATIDO
}

// Badges verificados após SESSAO_CONCLUIDA:
//   - PRIMEIRO_TREINO    → COUNT(sessoes concluidas) == 1
//   - TOTAL_SESSOES (10) → COUNT(sessoes concluidas) == 10
//   - TOTAL_SESSOES (50) → COUNT(sessoes concluidas) == 50
//   - MARATONA_SEMANAL   → COUNT(sessoes esta semana ISO) >= 5
//   - CONSTANCIA_DIAS    → sequência de dias sem interrupção >= 7 ou 30

// Badges verificados após PR_BATIDO:
//   - QUEBRANDO_LIMITES  → COUNT(records pessoais) == 1
//   - MAQUINA_DE_PR      → COUNT(records pessoais) == 10
```

A verificação de **constância de dias** é a mais complexa: requer calcular se há uma sequência ininterrupta de dias com sessão concluída. A query utiliza a função `LAG` do PostgreSQL para detectar quebras na sequência:

```sql
-- Calcula sequência atual de dias consecutivos com treino
WITH dias_treino AS (
    SELECT DISTINCT date_trunc('day', concluido_em)::date AS dia
    FROM sessao_treino
    WHERE aluno_id = $1
      AND status = 'CONCLUIDO'
),
sequencia AS (
    SELECT
        dia,
        dia - ROW_NUMBER() OVER (ORDER BY dia)::int AS grupo
    FROM dias_treino
),
contagem AS (
    SELECT
        MAX(dia) AS ultimo_dia,
        COUNT(*) AS dias_consecutivos
    FROM sequencia
    GROUP BY grupo
)
SELECT dias_consecutivos
FROM contagem
WHERE ultimo_dia = CURRENT_DATE
ORDER BY dias_consecutivos DESC
LIMIT 1;
```

#### Badges detectados por cron (verificação noturna)

O job diário (`verificar_badges_diario`) executa às 23:30 e avalia badges de constância para todos os alunos que tiveram sessão concluída no dia. Evita re-processamento verificando `EXISTS` na tabela `aluno_badge` antes de inserir.

### Cálculo do Ranking

**Escopo:** ranking exclusivamente entre alunos do mesmo personal. Não há ranking global entre todos os usuários da plataforma.

**Período:** semanal (semana ISO, segunda a domingo). O ranking é calculado e "congelado" toda domingo às 23:00.

**Critério de pontuação:**

| Ação | Pontos |
|---|---|
| Sessão concluída | +10 pontos |
| Recorde pessoal batido | +25 pontos |
| Badge desbloqueado | +15 pontos |
| Sessão concluída no horário programado (sem atraso >1 dia) | +5 pontos de bônus |

**Cálculo do ranking semanal (job domingo 23:00):**

```sql
-- Executado via pg_cron — gerar ranking semanal
INSERT INTO ranking_semanal (id, personal_id, ano, semana_iso, aluno_id, pontuacao, sessoes_semana, prs_semana, calculado_em)
SELECT
    gen_random_uuid(),
    a.personal_id,
    EXTRACT(ISOYEAR FROM CURRENT_DATE)::int,
    EXTRACT(WEEK FROM CURRENT_DATE)::int,
    a.id AS aluno_id,
    -- Pontuação: sessões * 10 + PRs * 25 + badges * 15
    (COALESCE(s.sessoes, 0) * 10 + COALESCE(p.prs, 0) * 25 + COALESCE(b.badges, 0) * 15) AS pontuacao,
    COALESCE(s.sessoes, 0),
    COALESCE(p.prs, 0),
    NOW()
FROM aluno a
LEFT JOIN (
    SELECT aluno_id, COUNT(*) AS sessoes
    FROM sessao_treino
    WHERE status = 'CONCLUIDO'
      AND date_trunc('week', concluido_em) = date_trunc('week', CURRENT_DATE)
    GROUP BY aluno_id
) s ON s.aluno_id = a.id
LEFT JOIN (
    SELECT aluno_id, COUNT(*) AS prs
    FROM record_pessoal
    WHERE date_trunc('week', criado_em) = date_trunc('week', CURRENT_DATE)
    GROUP BY aluno_id
) p ON p.aluno_id = a.id
LEFT JOIN (
    SELECT aluno_id, COUNT(*) AS badges
    FROM aluno_badge
    WHERE date_trunc('week', desbloqueado_em) = date_trunc('week', CURRENT_DATE)
    GROUP BY aluno_id
) b ON b.aluno_id = a.id
WHERE a.ativo = true;

-- Atualizar posição após inserção
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY personal_id, ano, semana_iso
               ORDER BY pontuacao DESC
           ) AS pos
    FROM ranking_semanal
    WHERE ano = EXTRACT(ISOYEAR FROM CURRENT_DATE)::int
      AND semana_iso = EXTRACT(WEEK FROM CURRENT_DATE)::int
)
UPDATE ranking_semanal r
SET posicao = ranked.pos
FROM ranked
WHERE r.id = ranked.id;
```

### Endpoints de Gamificação (fragmento OpenAPI)

```yaml
  /alunos/{id}/badges:
    get:
      tags: [Gamificacao]
      summary: Listar badges desbloqueados pelo aluno
      parameters:
        - $ref: "#/components/parameters/IdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  badges:
                    type: array
                    items:
                      type: object
                      properties:
                        badge:
                          type: object
                          properties:
                            id:        { type: string, format: uuid }
                            nome:      { type: string }
                            descricao: { type: string }
                            icone_url: { type: string, format: uri }
                        desbloqueado_em: { type: string, format: date-time }

  /personal/ranking:
    get:
      tags: [Gamificacao]
      summary: Ranking semanal dos alunos do personal autenticado
      parameters:
        - name: ano
          in: query
          schema: { type: integer }
        - name: semana
          in: query
          schema: { type: integer, minimum: 1, maximum: 53 }
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  ano:      { type: integer }
                  semana:   { type: integer }
                  ranking:
                    type: array
                    items:
                      type: object
                      properties:
                        posicao:        { type: integer }
                        aluno_id:       { type: string, format: uuid }
                        aluno_nome:     { type: string }
                        pontuacao:      { type: integer }
                        sessoes_semana: { type: integer }
                        prs_semana:     { type: integer }
```

---

## 18. Player de Treino — Especificação Técnica (Mobile)

### Máquina de Estados da Sessão

O Player de Treino é o componente de maior complexidade de estado do app mobile. O controle do fluxo é modelado como uma máquina de estados explícita — não como lógica condicional ad hoc em múltiplos `useState`.

```mermaid
stateDiagram-v2
    [*] --> Idle : abre tela de treino

    Idle --> CarregandoSessao : toca "Iniciar Treino"
    CarregandoSessao --> EmExercicio : POST /sessoes retorna sessao_id
    CarregandoSessao --> ErroIniciar : API error

    EmExercicio --> RegistrandoCarga : toca "Concluir Série" (abre input de carga)
    RegistrandoCarga --> EmExercicio : cancela input
    RegistrandoCarga --> SalvandoSerie : confirma carga (PATCH /sessoes/{id}/series)
    SalvandoSerie --> EmDescanso : série salva com sucesso E há descanso_segundos > 0
    SalvandoSerie --> EmExercicio : série salva E descanso = 0 ou null
    SalvandoSerie --> EmExercicio : erro → mantém tela, toast de erro

    EmDescanso --> EmExercicio : cronômetro zerou OU aluno toca "Pular Descanso"
    EmDescanso --> RegistrandoCarga : aluno toca "Próxima Série" antes de zerar

    EmExercicio --> Concluindo : última série do último exercício foi salva
    Concluindo --> Concluido : PATCH /sessoes/{id}/concluir retorna 200
    Concluido --> [*] : animação de conclusão → tela de resumo
```

A máquina de estados é implementada com `useReducer` do React (sem biblioteca externa):

```typescript
// features/player/hooks/usePlayerState.ts

type PlayerState =
  | { fase: 'idle' }
  | { fase: 'carregando_sessao' }
  | { fase: 'em_exercicio';    sessaoId: string; exercicioAtualIdx: number; serieAtualIdx: number }
  | { fase: 'registrando_carga'; sessaoId: string; exercicioAtualIdx: number; serieAtualIdx: number }
  | { fase: 'salvando_serie';  sessaoId: string; exercicioAtualIdx: number; serieAtualIdx: number }
  | { fase: 'em_descanso';     sessaoId: string; exercicioAtualIdx: number; serieAtualIdx: number; segundosRestantes: number }
  | { fase: 'concluindo';      sessaoId: string }
  | { fase: 'concluido';       sessaoId: string; resumo: ResumoSessao }
  | { fase: 'erro_iniciar' }

type PlayerAction =
  | { type: 'INICIAR_TREINO' }
  | { type: 'SESSAO_CRIADA'; sessaoId: string }
  | { type: 'ABRIR_INPUT_CARGA' }
  | { type: 'CANCELAR_INPUT_CARGA' }
  | { type: 'CONFIRMAR_CARGA'; carga: number | null; reps: number }
  | { type: 'SERIE_SALVA'; temDescanso: boolean; segundosDescanso: number; ehUltima: boolean }
  | { type: 'PULAR_DESCANSO' }
  | { type: 'DESCANSO_ZEROU' }
  | { type: 'TICK_DESCANSO' }
  | { type: 'SESSAO_CONCLUIDA'; resumo: ResumoSessao }
  | { type: 'ERRO'; origem: string }
```

### Cronômetro de Descanso

**Requisitos:**
- Contagem regressiva exibida com animação circular (anel que "esvazia").
- Tela não pode bloquear (usar `expo-keep-awake` para manter o dispositivo ativo).
- Vibração ao zerar o cronômetro (`expo-haptics`).

**Implementação do anel animado com `react-native-reanimated`:**

```typescript
// features/player/components/RestTimer.tsx

import { useEffect } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Circle, Svg } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface RestTimerProps {
  duracaoSegundos: number
  segundosRestantes: number
  onZerou: () => void
}

export function RestTimer({ duracaoSegundos, segundosRestantes, onZerou }: RestTimerProps) {
  const RAIO = 54
  const CIRCUNFERENCIA = 2 * Math.PI * RAIO

  const progresso = useSharedValue(1)  // 1 = cheio, 0 = vazio

  useEffect(() => {
    activateKeepAwakeAsync('rest-timer')
    return () => { deactivateKeepAwake('rest-timer') }
  }, [])

  useEffect(() => {
    const proporcao = segundosRestantes / duracaoSegundos
    progresso.value = withTiming(proporcao, {
      duration: 1000,
      easing: Easing.linear,
    })

    if (segundosRestantes === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onZerou()
    }
  }, [segundosRestantes])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUNFERENCIA * (1 - progresso.value),
  }))

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      {/* Trilha de fundo */}
      <Circle cx={60} cy={60} r={RAIO} stroke="var(--color-border)" strokeWidth={8} fill="none" />
      {/* Anel animado */}
      <AnimatedCircle
        cx={60}
        cy={60}
        r={RAIO}
        stroke="var(--color-primary)"
        strokeWidth={8}
        fill="none"
        strokeDasharray={CIRCUNFERENCIA}
        animatedProps={animatedProps}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
    </Svg>
  )
}
```

O `TICK_DESCANSO` é disparado por um `setInterval` de 1s gerenciado no hook `usePlayerState`, que decrementa `segundosRestantes` e despacha a action quando zera.

### Vídeo Demonstrativo Inline

**Biblioteca:** `expo-video` (SDK 50+) — substitui o `expo-av` para vídeo; suporte a controles nativos, mute automático, background-safe.

**Comportamento:**
- O vídeo é carregado ao montar o componente `ExercicioItem` (não ao abrir a tela de treino inteira, para evitar pré-carregamento desnecessário de todos os vídeos da sessão).
- Autoplay com `muted: true` ao entrar no viewport — sem interação requerida.
- Loop contínuo enquanto o exercício está na tela ativa.
- Controles mínimos: apenas mute/unmute e tela cheia.
- Se `midia_url` for nulo, exibe placeholder com ícone e nome do exercício.

```typescript
// features/player/components/ExercicioVideo.tsx

import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect } from 'react'

interface ExercicioVideoProps {
  midiaUrl: string | null
  tipo: 'VIDEO' | 'GIF' | 'IMAGEM' | null
  exercicioNome: string
}

export function ExercicioVideo({ midiaUrl, tipo, exercicioNome }: ExercicioVideoProps) {
  const player = useVideoPlayer(midiaUrl ?? '', (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  if (!midiaUrl || tipo === 'IMAGEM') {
    // fallback: expo-image para GIF ou imagem estática
    return <ExercicioPlaceholder nome={exercicioNome} midiaUrl={midiaUrl} />
  }

  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 8 }}
      nativeControls={false}
      contentFit="cover"
    />
  )
}
```

**Presigned URL para vídeos de exercícios privados:** exercícios globais têm `midia_url` em bucket público (acesso direto sem expiração). Exercícios customizados do personal têm URL assinada — o app solicita a URL ao abrir a tela de execução e armazena no cache do TanStack Query com `staleTime` de 55 minutos (TTL da presigned URL é de 1h).

### Campo de Carga

**Requisito:** teclado numérico com suporte a decimais (ex: 22.5), confirmação rápida, persistência otimista.

**Implementação:**

- `TextInput` nativo com `keyboardType="numeric"` e máscara manual para aceitar apenas dígitos e um ponto/vírgula.
- Ao confirmar: dispatch `CONFIRMAR_CARGA` → TanStack Mutation em background → UI prossegue imediatamente (optimistic).
- Em caso de erro da API: o estado reverte e exibe toast de erro; o campo reabre com o valor que o usuário havia digitado.

```typescript
// features/player/components/CargaInput.tsx

import { useState } from 'react'
import { TextInput, TouchableOpacity, View, Text } from 'react-native'

interface CargaInputProps {
  cargaSugerida: number | null
  onConfirmar: (carga: number | null, reps: number) => void
  onCancelar: () => void
}

export function CargaInput({ cargaSugerida, onConfirmar, onCancelar }: CargaInputProps) {
  const [carga, setCarga] = useState(cargaSugerida?.toString() ?? '')
  const [reps, setReps] = useState('')

  function handleCargaChange(text: string) {
    // Permite apenas dígitos e um separador decimal
    const sanitizado = text.replace(',', '.').replace(/[^0-9.]/g, '')
    const partes = sanitizado.split('.')
    if (partes.length > 2) return  // impede múltiplos pontos
    setCarga(sanitizado)
  }

  function handleConfirmar() {
    const cargaNum = carga === '' ? null : parseFloat(carga)
    const repsNum = reps === '' ? 0 : parseInt(reps, 10)
    if (isNaN(repsNum) || repsNum < 0) return
    onConfirmar(cargaNum, repsNum)
  }

  return (
    <View className="p-4 bg-bg-subtle rounded-xl gap-3">
      <TextInput
        placeholder={cargaSugerida ? `Sugerido: ${cargaSugerida}kg` : 'Carga (kg)'}
        value={carga}
        onChangeText={handleCargaChange}
        keyboardType="numeric"
        autoFocus
        className="text-2xl font-bold text-center text-text border-b border-border pb-2"
      />
      <TextInput
        placeholder="Repetições realizadas"
        value={reps}
        onChangeText={setReps}
        keyboardType="number-pad"
        className="text-xl text-center text-text border-b border-border pb-2"
      />
      <View className="flex-row gap-2 mt-2">
        <TouchableOpacity onPress={onCancelar} className="flex-1 py-3 rounded-lg bg-bg-muted">
          <Text className="text-center text-text-muted">Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleConfirmar} className="flex-1 py-3 rounded-lg bg-primary">
          <Text className="text-center text-white font-semibold">Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
```

### User Flow do Player (estados visuais)

```mermaid
stateDiagram-v2
    [*] --> ListaExercicios : tela de treino carregada

    ListaExercicios --> ExercicioAtivo : rola para exercício atual
    note right of ExercicioAtivo
        Exibe: vídeo, nome, séries planejadas
        Botão: "Concluir Série N de X"
    end note

    ExercicioAtivo --> InputCarga : toca "Concluir Série"
    note right of InputCarga
        Modal bottom sheet
        Campo carga (decimal) + reps realizadas
        Teclado numérico automático
    end note

    InputCarga --> ExercicioAtivo : cancela
    InputCarga --> SalvandoOtimista : confirma
    note right of SalvandoOtimista
        UI marca série como concluída imediatamente
        API call em background
    end note

    SalvandoOtimista --> Descanso : sucesso + descanso > 0
    SalvandoOtimista --> ExercicioAtivo : sucesso + sem descanso
    SalvandoOtimista --> ExercicioAtivo : erro → reverte + toast

    Descanso --> ExercicioAtivo : cronômetro zerou (vibração)
    Descanso --> ExercicioAtivo : toca "Pular Descanso"
    note right of Descanso
        Anel animado regressivo
        Tela mantida ativa (keep-awake)
        Exibe próximo exercício em preview
    end note

    ExercicioAtivo --> AnimacaoConclusao : última série do treino salva
    AnimacaoConclusao --> ResumoDaSessao : animação (Lottie/Reanimated, 2s)
    note right of ResumoDaSessao
        Total de séries, carga total
        Badges desbloqueados nesta sessão
        Botão: "Fechar"
    end note
```

### Estrutura de Pastas Mobile — Player (adendo à Seção 7)

```
apps/mobile/features/player/
├── components/
│   ├── RestTimer.tsx           # Anel animado + keep-awake
│   ├── ExercicioVideo.tsx      # expo-video wrapper
│   ├── CargaInput.tsx          # Input decimal + confirmação
│   ├── SerieProgressBar.tsx    # Progresso de séries do exercício atual
│   ├── ResumoDaSessao.tsx      # Tela de conclusão com badges
│   └── ProximoExercicioPreview.tsx
├── hooks/
│   ├── usePlayerState.ts       # useReducer — máquina de estados
│   ├── useRestTimer.ts         # setInterval + dispatch TICK_DESCANSO
│   └── useSalvarSerie.ts       # TanStack Mutation com rollback
└── index.ts
```

---

## 19. Atualizações no Roadmap

A tabela abaixo redistribui os novos itens das seções 13-18 nas fases existentes, mantendo a coerência de dependências técnicas (ex: infraestrutura de real-time antes de chat).

### Fase 0 — Fundação (Semana 1-2) — sem alterações

| Entregável | Responsável |
|---|---|
| Setup monorepo (pnpm + Turborepo + Go workspace) | Backend |
| Namespace K8s, secrets, PostgreSQL StatefulSet, MinIO | DevOps |
| Migrations iniciais (tabelas core do ERD) | Backend |
| Pipeline Tekton: build API + web | DevOps |
| ArgoCD Application CR apuntando para `infra/k8s/` | DevOps |
| Pacote `@amfit/shared` com schemas Zod base | Frontend |

### Fase 1 — MVP Core (Semana 3-6) — adições marcadas com [NOVO]

| Entregável | Contexto |
|---|---|
| Auth completo (login, refresh, logout) — Personal + Aluno | Identity |
| CRUD de alunos (Personal) — portal web | Identity |
| **[NOVO] Cadastro de anamnese do aluno — portal web** | Identity |
| CRUD de exercícios com upload de mídia — portal web | Catalog |
| Cadastro de exercícios com upload de mídia — app mobile (Personal) | Catalog |
| Montagem de fichas de treino (A/B/C) — portal web | Training |
| App mobile: roteamento por role (Aluno / Personal) | Identity |
| App mobile: tela de login | Identity |
| **[NOVO] Registro de push_token no login — mobile** | Notification |
| App mobile [Aluno]: Player de Treino — máquina de estados, vídeo inline, campo de carga | Execution |
| App mobile [Aluno]: cronômetro de descanso (RestTimer + keep-awake) | Execution |
| App mobile [Aluno]: registrar séries com detecção de PR em tempo real | Execution + Progress |
| App mobile [Personal]: dashboard básico + lista de exercícios | Progress |
| Dashboard básico do personal (alunos treinaram hoje) — portal web | Progress |

### Fase 2 — Experiência Completa (Semana 7-10) — adições marcadas com [NOVO] e [DIFERENCIAL]

| Entregável | Contexto |
|---|---|
| Histórico de sessões — mobile + web | Execution |
| Gráficos de evolução de carga por exercício | Progress |
| Medidas corporais (cadastro + histórico) | Progress |
| **[NOVO] Fotos de evolução (antes/depois) — mobile; bucket evolucao/ no MinIO** | Progress |
| **[NOVO] Galeria de fotos de evolução — portal web** | Progress |
| Rotação automática de treino A/B/C | Training |
| Duplicar/reaproveitar fichas de treino | Training |
| Busca full-text em exercícios | Catalog |
| **[NOVO] Módulo Financeiro: configuração de plano e gestão de mensalidades — portal web** | Financial |
| **[NOVO] Integração Asaas: geração de link de pagamento + webhook PAYMENT_RECEIVED** | Financial |
| **[NOVO] Jobs pg_cron: geração mensal de mensalidades e lembretes D-3/D-1/D0** | Financial |
| **[NOVO] Notification Dispatcher (worker Go): envio de pushes via Expo Push API** | Notification |
| **[NOVO] Notificações push: treino concluído, PR batido, mensalidade vencendo** | Notification |
| **[NOVO] Chat aluno ↔ personal: WebSocket Hub + Redis Pub/Sub + persistência** | Chat |
| **[NOVO] Chat: fallback push para mensagem recebida com destinatário offline** | Chat |
| **[NOVO] Gamificação: badges de primeira sessão, constância 7 dias, primeiro PR** | Gamification |
| **[NOVO] Ranking semanal por personal — cálculo via job domingo** | Gamification |
| **[NOVO] Tela de badges e ranking — app mobile (Aluno)** | Gamification |
| **[DIFERENCIAL] Progressive Overload Automático: goroutine de verificação pós-sessão, entidade sugestao_progressao, badge na SerieRow** | Execution + Progress |
| **[DIFERENCIAL] Anamnese Inteligente com Scoring: campo respostas_json JSONB, cálculo de nível, template_treino sugerido** | Identity + Training |
| **[DIFERENCIAL] Compartilhamento em Redes Sociais: card de conclusão gerado client-side com react-native-view-shot + expo-sharing** | Execution |

### Fase 3 — Polimento e Expansão (Semana 11-14) — adições marcadas com [NOVO] e [DIFERENCIAL]

| Entregável | Contexto |
|---|---|
| Dark mode (web + mobile) | — |
| Relatório PDF de evolução do aluno | Progress |
| Compartilhamento de exercícios entre personals | Catalog |
| Planos de assinatura / billing (multi-tenant) | Identity |
| Exportação de dados (LGPD) | Identity |
| Testes E2E web (Playwright) e mobile (Detox) | QA |
| **[NOVO] Dashboard financeiro do personal: inadimplência, receita mensal, gráfico** | Financial |
| **[NOVO] Gamificação: badges avançados (30 dias consecutivos, 50 sessões, 10 PRs)** | Gamification |
| **[NOVO] Ranking histórico — comparação semana a semana** | Gamification |
| **[NOVO] Notificações in-app: centro de notificações no app mobile (histórico)** | Notification |
| **[NOVO] Chat: indicador de digitando (typing indicator) via WebSocket** | Chat |
| **[NOVO] Tela de evolução biométrica com gráficos (peso, % gordura) — mobile** | Progress |
| **[DIFERENCIAL] White Label Multi-Tenant: entidade tenant_config, injeção de CSS vars server-side no Next.js, ThemeProvider NativeWind no mobile, IngressRoute dinâmica no Traefik** | Identity |
| **[DIFERENCIAL] Coach Assíncrono por Vídeo: upload para MinIO bucket coach-videos/, entidade coach_video, feedback com áudio, integração com Chat** | Execution + Chat |
| **[DIFERENCIAL] Geração de Ficha com IA (Claude API): POST /fichas/gerar-ia, prompt caching, rascunho editável no FichaBuilder, tabela ia_usage** | Training |

### Fase 4 — V2 (pós-MVP)

| Entregável |
|---|
| Vídeo demonstrativo de exercício no app (HLS streaming via MinIO) |
| Temporizador de descanso com vibração (expo-haptics) |
| Integração com balança Bluetooth (bare workflow) |
| Modo offline com sync (WatermelonDB) |
| App mobile [Personal]: montagem de fichas de treino diretamente no mobile |
| **[NOVO] Conciliação financeira automática: relatório mensal de receita vs. inadimplência** |
| **[NOVO] Gamificação: desafios personalizados criados pelo personal (ex: "5 treinos esta semana")** |
| **[NOVO] Chat: suporte a envio de imagens e áudios curtos** |
| **[NOVO] Notificações programadas pelo personal: avisos de evento, horário de treino** |
| **[DIFERENCIAL] Integração com Wearables: Apple Health (HealthKit) + Google Health Connect, entidade sessao_biometrics, leitura de FC e calorias pós-sessão, bare workflow (Execution)** |

---

## 20. Funcionalidades Diferenciais

Esta seção documenta as sete funcionalidades priorizadas para diferenciar o AMFIT de concorrentes genéricos. Cada subseção apresenta a descrição de negócio, o modelo de dados incremental, o fluxo principal e as decisões técnicas relevantes.

---

### 20.1 Progressive Overload Automático

**Fase:** 2  
**Bounded Context:** Execution (disparo) + Progress (lógica de verificação + entidade sugestao_progressao)

#### Descrição

Ao concluir uma sessão, o sistema verifica automaticamente se o aluno completou 100% das séries dentro das reps-alvo nas últimas três sessões consecutivas do mesmo exercício. Quando a condição é satisfeita, uma sugestão de incremento de carga é persistida e o personal é notificado. O aluno vê a sugestão no Player antes de iniciar a próxima série do exercício.

**Incrementos padrão (configuráveis por personal no `item_treino`):**
- Membros inferiores (quadríceps, posterior, glúteo, panturrilha): +2,5 kg
- Membros superiores e core: +1,25 kg

#### Modelo de Dados

```mermaid
erDiagram
    SUGESTAO_PROGRESSAO {
        uuid id PK
        uuid aluno_id FK "not null"
        uuid item_treino_id FK "not null"
        decimal carga_atual "precision 6,2 — not null"
        decimal carga_sugerida "precision 6,2 — not null"
        enum status "PENDENTE|ACEITA|REJEITADA"
        string motivo_rejeicao "nullable"
        uuid gerada_em_sessao_id FK "sessao que disparou a sugestão"
        timestamp criado_em "default now()"
        timestamp atualizado_em "nullable"
    }

    ITEM_TREINO {
        uuid id PK
        decimal incremento_inferior_kg "default 2.5"
        decimal incremento_superior_kg "default 1.25"
    }

    SUGESTAO_PROGRESSAO }|--|| ITEM_TREINO : "referencia"
    SUGESTAO_PROGRESSAO }|--|| ALUNO : "pertence"
```

**Índice:**
```sql
-- Sugestão pendente por aluno e item (consultada ao exibir SerieRow)
CREATE INDEX idx_sugestao_progressao_pendente
    ON sugestao_progressao(aluno_id, item_treino_id)
    WHERE status = 'PENDENTE';
```

#### Fluxo Principal

```mermaid
sequenceDiagram
    participant AL as Aluno (App)
    participant API as AMFIT API
    participant PG as PostgreSQL
    participant GO as Goroutine de Verificação
    participant NOTIF as Notification Context

    AL->>API: PATCH /sessoes/{id}/concluir
    API->>PG: UPDATE sessao_treino SET status=CONCLUIDO, concluido_em=now()
    API-->>AL: 200 SessaoResponse

    Note over API,GO: Goroutine disparada de forma assíncrona — não bloqueia a resposta

    API->>GO: go verificarProgressao(ctx5s, sessaoID, alunoID)

    GO->>PG: SELECT últimas 3 sessoes concluídas por exercício do aluno
    GO->>PG: Para cada item_treino: verificar se 3/3 sessões tiveram 100% séries dentro das reps-alvo

    alt Condição satisfeita para item X
        GO->>PG: INSERT sugestao_progressao (status=PENDENTE)
        GO->>NOTIF: Emite progressao.sugerida → push para personal
    else Condição não satisfeita
        GO->>GO: Nenhuma ação
    end
```

**Detalhe da goroutine com `context.WithTimeout`:**

```go
// internal/execution/application/concluir_sessao.go

func (uc *ConcluirSessaoUseCase) Execute(ctx context.Context, sessaoID string) (*SessaoResponse, error) {
    sessao, err := uc.repo.ConcluirSessao(ctx, sessaoID)
    if err != nil {
        return nil, err
    }

    // Goroutine assíncrona — não bloqueia a resposta ao cliente
    // context.WithTimeout de 5s para evitar goroutine leak
    go func() {
        verCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        if err := uc.progressoSvc.VerificarProgressao(verCtx, sessao.AlunoID, sessaoID); err != nil {
            slog.Warn("verificar_progressao falhou", "sessao_id", sessaoID, "err", err)
        }
    }()

    return toResponse(sessao), nil
}
```

#### Decisões Técnicas e Trade-offs

| Decisão | Escolha | Justificativa |
|---|---|---|
| Execução assíncrona | Goroutine com `context.WithTimeout(5s)` | Não penaliza a latência do `PATCH /concluir` — operação crítica do Player |
| Persistência da sugestão | Tabela `sugestao_progressao` | Permite histórico de sugestões aceitas/rejeitadas para análise futura |
| Notificação para personal | Reutiliza Notification Context existente | Sem nova infraestrutura; evento `progressao.sugerida` → push via Expo Push API |
| Exibição no mobile | Badge na `SerieRow` consultando endpoint `GET /sessoes/proxima/sugestoes?item_treino_id=` | Carregado ao abrir o Player; `staleTime` de 60s no TanStack Query |

**Alteração na `SerieRow` mobile:**
```typescript
// features/player/components/SerieRow.tsx — adição do badge de sugestão
{sugestaoPendente && (
  <View className="bg-orange-100 px-2 py-0.5 rounded-full flex-row items-center gap-1">
    <Text className="text-orange-700 text-xs font-semibold">
      ↑ +{sugestaoPendente.incremento}kg sugerido
    </Text>
  </View>
)}
```

---

### 20.2 Anamnese Inteligente com Scoring

**Fase:** 2  
**Bounded Context:** Identity (dados do aluno) + Training (template sugerido)

#### Descrição

O formulário de anamnese é estendido com um campo `respostas_json` (JSONB) contendo respostas a perguntas padronizadas. Cada resposta vale pontos; a soma determina o nível do aluno. Ao finalizar, a API retorna `nivel_sugerido` e o `template_ficha_id` correspondente. O personal pode aceitar o template ou montar a ficha do zero.

#### Tabela de Scoring

| Pergunta | Opção | Pontos |
|---|---|---|
| Frequência semanal atual de exercícios | Nenhuma (sedentário) | 0 |
| | 1-2 dias/semana | 10 |
| | 3-4 dias/semana | 20 |
| | 5+ dias/semana | 30 |
| Experiência prévia com musculação | Nunca treinei | 0 |
| | Menos de 6 meses | 5 |
| | 6 meses a 2 anos | 15 |
| | Mais de 2 anos | 25 |
| Objetivo principal | Emagrecimento | 0 |
| | Condicionamento geral | 5 |
| | Hipertrofia | 10 |
| | Performance/força | 15 |
| Restrições médicas relevantes | Sim (limitam exercícios) | -10 |
| | Não | 0 |
| Disponibilidade semanal | 2 dias | 0 |
| | 3 dias | 5 |
| | 4-5 dias | 10 |

**Faixas de nível:**
- 0–30 pontos → **Iniciante**
- 31–60 pontos → **Intermediário**
- 61+ pontos → **Avançado**

#### Modelo de Dados

```mermaid
erDiagram
    ANAMNESE {
        uuid id PK
        uuid aluno_id FK "not null — UK"
        text objetivo "not null"
        text lesoes "nullable"
        text doencas_preexistentes "nullable"
        text medicamentos "nullable"
        boolean pratica_outro_esporte "default false"
        text outro_esporte "nullable"
        int frequencia_semanas_anterior "nullable"
        text observacoes_gerais "nullable"
        jsonb respostas_json "perguntas padronizadas e pontuações"
        int score_calculado "nullable — soma dos pontos"
        enum nivel_sugerido "INICIANTE|INTERMEDIARIO|AVANCADO nullable"
        timestamp preenchido_em "not null"
        timestamp atualizado_em
    }

    TEMPLATE_TREINO {
        uuid id PK
        string nome "not null"
        enum nivel "INICIANTE|INTERMEDIARIO|AVANCADO"
        string objetivo "hipertrofia|emagrecimento|forca|condicionamento"
        enum criado_por "SISTEMA|PERSONAL"
        uuid personal_id "nullable — null = template global do sistema"
        boolean ativo "default true"
        timestamp criado_em
    }

    TEMPLATE_ITEM {
        uuid id PK
        uuid template_id FK "not null"
        uuid exercicio_id FK "not null"
        string treino_letra "A|B|C"
        int ordem "not null"
        int series "not null"
        string repeticoes "ex: 8-12"
        decimal carga_sugerida "nullable"
        int descanso_segundos "nullable"
    }

    TEMPLATE_TREINO ||--|{ TEMPLATE_ITEM : "define"
    ANAMNESE }|--o| TEMPLATE_TREINO : "sugere"
```

#### Fluxo Principal

```mermaid
sequenceDiagram
    participant PT as Personal (Web)
    participant API as AMFIT API
    participant PG as PostgreSQL

    PT->>API: POST /alunos/{id}/anamnese {objetivo, respostas_json: {...}, ...}
    API->>API: Calcular score: soma pontos de cada resposta no respostas_json
    API->>API: Determinar nivel_sugerido (INICIANTE|INTERMEDIARIO|AVANCADO)
    API->>PG: UPSERT anamnese SET score_calculado=X, nivel_sugerido=Y

    API->>PG: SELECT template_treino WHERE nivel=Y AND objetivo~=objetivo_aluno ORDER BY criado_por='PERSONAL' DESC LIMIT 1
    PG-->>API: template_ficha (pode ser null)

    API-->>PT: 200 { nivel_sugerido, score, template_ficha_id, template_ficha_nome }

    alt Personal aceita o template
        PT->>API: POST /fichas/from-template {template_id, aluno_id, vigencia_inicio}
        API->>PG: Copia template_item → item_treino na nova ficha
        API-->>PT: 201 FichaResponse (editável no FichaBuilder)
    else Personal monta do zero
        PT->>API: POST /fichas {aluno_id, nome, vigencia_inicio}
        API-->>PT: 201 FichaResponse vazia
    end
```

#### Estrutura do `respostas_json`

```json
{
  "frequencia_semanal": { "opcao": "3-4 dias/semana", "pontos": 20 },
  "experiencia_meses":  { "opcao": "6 meses a 2 anos",  "pontos": 15 },
  "objetivo":           { "opcao": "hipertrofia",        "pontos": 10 },
  "restricoes":         { "opcao": "nao",                "pontos": 0  },
  "disponibilidade":    { "opcao": "3 dias",             "pontos": 5  }
}
```

#### Decisões Técnicas

- O score é calculado **no backend** no momento do `POST /anamnese` — nunca pelo cliente. Garante consistência e auditabilidade.
- A tabela `template_treino` suporta templates globais do sistema (`personal_id IS NULL`) e templates customizados do personal. A query prioriza os do personal quando o nível/objetivo coincide.
- Novos endpoints adicionados ao contrato OpenAPI: `POST /alunos/{id}/anamnese`, `GET /alunos/{id}/anamnese`, `GET /templates-treino`, `POST /fichas/from-template`.

---

### 20.3 Compartilhamento em Redes Sociais

**Fase:** 2  
**Bounded Context:** Execution (dados da sessão) + Identity (tenant_config para White Label)

#### Descrição

Ao concluir uma sessão, o app oferece ao aluno a opção de compartilhar um card visual. O card é gerado inteiramente no cliente (React Native) usando `react-native-view-shot` para capturar o componente renderizado e `expo-sharing` para abrir o sheet nativo do SO. Nenhum dado sensível (peso corporal, fotos de evolução) é incluído.

#### Endpoint de Dados do Card

```yaml
  /sessoes/{id}/share-card-data:
    get:
      tags: [Sessoes]
      summary: Retorna dados públicos para montagem do card de compartilhamento
      parameters:
        - $ref: "#/components/parameters/IdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  treino_nome:       { type: string }
                  data_execucao:     { type: string, format: date }
                  total_series:      { type: integer }
                  total_exercicios:  { type: integer }
                  duracao_minutos:   { type: integer }
                  prs_batidos:
                    type: array
                    items:
                      type: object
                      properties:
                        exercicio_nome: { type: string }
                        carga_kg:       { type: number }
                  streak_dias:       { type: integer, description: "dias consecutivos de treino até hoje" }
                  personal_logo_url: { type: string, format: uri, nullable: true, description: "tenant_config.logo_url" }
                  personal_nome:     { type: string }
```

**Campos explicitamente ausentes:** `peso_corporal`, `gordura_pct`, `fotos_evolucao`, `medidas_corporais`.

#### Fluxo Principal

```mermaid
sequenceDiagram
    participant AL as Aluno (App)
    participant API as AMFIT API
    participant OS as Sistema Operacional (iOS/Android)

    AL->>AL: Sessão concluída → AnimacaoConclusao exibe botão "Compartilhar"
    AL->>API: GET /sessoes/{id}/share-card-data
    API-->>AL: { treino_nome, prs_batidos, streak_dias, personal_logo_url, ... }

    AL->>AL: Renderiza <ShareCard> com os dados (componente fora da tela — offscreen)
    AL->>AL: react-native-view-shot.captureRef(ref) → base64 PNG
    AL->>AL: Salva PNG temporariamente em cache local
    AL->>OS: expo-sharing.shareAsync(filePath, { mimeType: 'image/png' })
    OS-->>AL: Sheet nativo com destinos (Instagram Stories, WhatsApp, etc.)
    AL->>AL: Usuário escolhe destino ou cancela
```

#### Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Geração da imagem | Client-side (react-native-view-shot) | Sem custo de servidor; zero latência de render; personalizável com tokens de tema |
| Compartilhamento | expo-sharing (nativo) | Abre sheet do SO — suporta qualquer destino instalado no dispositivo |
| Dados sensíveis | Excluídos explicitamente no endpoint | Política de privacidade: aluno controla o que compartilha; peso/fotos nunca no card |
| Logo do personal | Inclusa via `tenant_config.logo_url` (White Label) | Card reflete a marca do personal — diferencial de produto |
| Formato | PNG (não JPEG) | Melhor qualidade para texto e logos; tamanho aceitável para um card ~400x600px |

**Componente `ShareCard` (estrutura):**

```typescript
// features/player/components/ShareCard.tsx
// Componente renderizado offscreen — apenas para captura com view-shot

interface ShareCardProps {
  data: ShareCardData
}

export const ShareCard = React.forwardRef<View, ShareCardProps>(({ data }, ref) => (
  <View ref={ref} className="w-[360px] h-[560px] bg-slate-900 p-6 rounded-2xl">
    {data.personal_logo_url && (
      <Image source={{ uri: data.personal_logo_url }} className="w-16 h-16 rounded-full mb-4" />
    )}
    <Text className="text-white text-2xl font-bold">{data.treino_nome}</Text>
    <Text className="text-slate-400 text-sm mb-6">{formatarData(data.data_execucao)}</Text>

    {data.prs_batidos.length > 0 && (
      <View className="bg-orange-500/20 rounded-xl p-4 mb-4">
        <Text className="text-orange-400 font-semibold mb-2">PRs desta sessão</Text>
        {data.prs_batidos.map(pr => (
          <Text key={pr.exercicio_nome} className="text-white">
            {pr.exercicio_nome} — {pr.carga_kg}kg
          </Text>
        ))}
      </View>
    )}

    <Text className="text-slate-300 text-lg">
      {data.streak_dias} dias consecutivos de treino
    </Text>
    <Text className="text-slate-500 text-xs mt-auto">amfit.app</Text>
  </View>
))
```

---

### 20.4 White Label (Multi-Tenant Branding)

**Fase:** 3  
**Bounded Context:** Identity (entidade tenant_config) — lido por Web e Mobile

#### Descrição

Cada personal trainer pode configurar a identidade visual da plataforma para seus alunos: logo, cores primária e secundária, nome do app e domínio customizado. No portal web, as CSS vars são injetadas server-side no `<html>` sem rebuild. No mobile, o `ThemeProvider` do NativeWind lê os tokens do `AsyncStorage`.

#### Modelo de Dados

```mermaid
erDiagram
    TENANT_CONFIG {
        uuid personal_id PK "FK para personal_trainer — 1:1"
        string logo_url "MinIO bucket tenant-logos/ — public"
        string cor_primaria "hex sem # — ex: ea580c"
        string cor_secundaria "hex sem # — ex: f97316"
        string nome_app "nullable — default: AMFIT"
        string dominio_customizado "nullable — ex: app.meuStudio.com.br"
        timestamp atualizado_em "default now()"
    }

    PERSONAL_TRAINER ||--o| TENANT_CONFIG : "possui"
```

#### Fluxo Web — Injeção Server-Side de CSS Vars

```mermaid
sequenceDiagram
    participant Browser as Browser (Personal ou Aluno via web)
    participant NEXT as Next.js (Server Component)
    participant API as AMFIT API
    participant PG as PostgreSQL

    Browser->>NEXT: GET /dashboard (ou domínio customizado)
    NEXT->>NEXT: Middleware extrai personal_id do JWT (ou do domínio)
    NEXT->>API: GET /tenants/me/config (server-side, Bearer token)
    API->>PG: SELECT tenant_config WHERE personal_id=?
    PG-->>API: { cor_primaria, cor_secundaria, logo_url, nome_app }
    API-->>NEXT: TenantConfigResponse

    NEXT->>NEXT: Gera inline style para o elemento <html>:
    Note over NEXT: style="--color-primary:#ea580c; --color-primary-hover:#f97316;"
    NEXT-->>Browser: HTML com CSS vars injetadas no <html> — sem flash de tema
```

**Implementação no `app/layout.tsx`:**

```typescript
// apps/web/app/layout.tsx
import { getTenantConfig } from '@/shared/lib/tenant'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getTenantConfig()   // server-side fetch

  const cssVars = config ? {
    '--color-primary':       `#${config.cor_primaria}`,
    '--color-primary-hover': `#${config.cor_secundaria}`,
  } as React.CSSProperties : {}

  return (
    <html lang="pt-BR" style={cssVars}>
      <body>{children}</body>
    </html>
  )
}
```

#### Fluxo Mobile — ThemeProvider com AsyncStorage

```mermaid
sequenceDiagram
    participant APP as App Mobile (Expo)
    participant STORE as AsyncStorage
    participant API as AMFIT API

    APP->>APP: Startup — lê código do personal no convite (deep link ou QR code)
    APP->>API: GET /tenants/{codigo}/config (sem autenticação — público)
    API-->>APP: { cor_primaria, cor_secundaria, logo_url, nome_app }

    APP->>STORE: AsyncStorage.setItem('tenant_config', JSON.stringify(config))
    APP->>APP: ThemeProvider lê STORE → sobrescreve tokens NativeWind

    Note over APP: Sessões subsequentes: lê do AsyncStorage sem nova chamada de API
    Note over APP: TTL de 24h — revalida em background se cache expirado
```

**ThemeProvider mobile:**

```typescript
// apps/mobile/shared/providers/ThemeProvider.tsx
import AsyncStorage from '@react-native-async-storage/async-storage'
import { vars } from 'nativewind'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(defaultTheme)

  useEffect(() => {
    AsyncStorage.getItem('tenant_config').then(raw => {
      if (!raw) return
      const config = JSON.parse(raw)
      setTheme(vars({
        '--color-primary': `#${config.cor_primaria}`,
        '--color-primary-hover': `#${config.cor_secundaria}`,
      }))
    })
  }, [])

  return <View style={theme}>{children}</View>
}
```

#### Infraestrutura — Domínio Customizado no Traefik

```yaml
# infra/k8s/web/ingress-tenant.yaml
# IngressRoute dinâmica gerada pelo operador ou aplicada via ArgoCD por personal
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: amfit-tenant-custom
  namespace: amfit
spec:
  entryPoints: [websecure]
  routes:
    - match: Host(`app.meuStudio.com.br`)
      kind: Rule
      services:
        - name: amfit-web
          port: 3000
  tls:
    certResolver: letsencrypt
```

**Estratégia:** wildcard `*.amfit.app` no certificado TLS para subdomínios gerenciados pela plataforma. Domínios customizados (CNAME do personal) requerem `IngressRoute` individual + cert-manager com `CertificateRequest` por domínio.

#### Endpoints Adicionais

```yaml
  /tenants/me/config:
    get:
      tags: [Tenant]
      summary: Retorna configuração de branding do personal autenticado
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TenantConfigResponse"
    put:
      tags: [Tenant]
      summary: Atualiza configuração de branding
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                logo:            { type: string, format: binary }
                cor_primaria:    { type: string, pattern: "^[0-9a-fA-F]{6}$" }
                cor_secundaria:  { type: string, pattern: "^[0-9a-fA-F]{6}$" }
                nome_app:        { type: string }
                dominio_customizado: { type: string }
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TenantConfigResponse"

  /tenants/{codigo}/config:
    get:
      tags: [Tenant]
      summary: Retorna configuração pública pelo código do personal (para mobile onboarding)
      security: []
      parameters:
        - name: codigo
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TenantConfigResponse"
        "404":
          $ref: "#/components/responses/NotFound"
```

---

### 20.5 Coach Assíncrono por Vídeo

**Fase:** 3  
**Bounded Context:** Execution (upload do clip) + Chat (exibição do feedback)

#### Descrição

O aluno grava ou seleciona um clipe de até 60s mostrando a execução de um exercício. O vídeo é enviado para o MinIO em bucket privado. O personal assiste ao vídeo via presigned URL e envia um feedback em texto e/ou áudio. O feedback aparece como mensagem especial no canal de chat do par aluno-personal, com referência ao vídeo.

#### Modelo de Dados

```mermaid
erDiagram
    COACH_VIDEO {
        uuid id PK
        uuid aluno_id FK "not null"
        uuid personal_id FK "not null"
        uuid item_treino_id FK "nullable — exercício específico"
        string video_object_key "MinIO key — coach-videos/{personal_id}/{id}.mp4"
        int duracao_segundos "not null — max 60"
        enum status "AGUARDANDO_FEEDBACK|FEEDBACK_ENVIADO|ARQUIVADO"
        string descricao "nullable — aluno descreve o que quer feedback"
        timestamp criado_em "default now()"
        timestamp atualizado_em
    }

    COACH_VIDEO_FEEDBACK {
        uuid id PK
        uuid video_id FK "not null"
        uuid personal_id FK "not null"
        text texto "nullable"
        string audio_object_key "MinIO key — coach-audios/{id}.m4a nullable"
        int audio_duracao_segundos "nullable"
        uuid mensagem_canal_id FK "nullable — mensagem gerada no Chat Context"
        timestamp enviado_em "default now()"
    }

    COACH_VIDEO ||--o| COACH_VIDEO_FEEDBACK : "recebe"
```

#### Fluxo Principal

```mermaid
sequenceDiagram
    participant AL as Aluno (App)
    participant API as AMFIT API
    participant MINIO as MinIO (bucket: coach-videos)
    participant PT as Personal (Web + App)
    participant CHAT as Chat Context

    Note over AL: Aluno acessa tela "Enviar Vídeo para Coach"

    AL->>AL: Grava via expo-camera (max 60s) OU seleciona da galeria via expo-image-picker
    AL->>API: POST /coach/videos (multipart: video, item_treino_id?, descricao?)
    API->>MINIO: PutObject bucket=coach-videos key={personal_id}/{uuid}.mp4
    MINIO-->>API: ETag confirmado
    API->>API: INSERT coach_video (status=AGUARDANDO_FEEDBACK)
    API->>CHAT: Emite notificação: "Aluno X enviou vídeo para revisão"
    API-->>AL: 201 { id, status: AGUARDANDO_FEEDBACK }

    Note over PT: Personal acessa lista de vídeos aguardando feedback

    PT->>API: GET /coach/videos?status=AGUARDANDO_FEEDBACK
    API->>MINIO: Gera presigned URL (TTL 24h) para cada video_object_key
    API-->>PT: lista com presigned_url por vídeo

    PT->>PT: Assiste ao vídeo (player inline no portal web)
    PT->>API: POST /coach/videos/{id}/feedback { texto?, audio? (multipart) }

    opt Áudio enviado
        API->>MINIO: PutObject bucket=coach-audios key={uuid}.m4a
    end

    API->>API: UPDATE coach_video SET status=FEEDBACK_ENVIADO
    API->>API: INSERT coach_video_feedback
    API->>CHAT: INSERT mensagem no canal_chat com tipo especial COACH_FEEDBACK
    API->>API: Emite notificação push: "Seu personal enviou feedback no vídeo de {exercicio}"
    API-->>PT: 201 FeedbackResponse
```

#### Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Bucket de vídeos | Privado com presigned URL (TTL 24h) | Clipes de execução são dados sensíveis — não devem ser indexados publicamente |
| Integração com Chat | Feedback aparece como mensagem especial com `tipo=COACH_FEEDBACK` | Centraliza a comunicação aluno-personal sem criar uma nova tela; reutiliza infraestrutura WebSocket existente |
| Upload no mobile | `multipart/form-data` via `POST /coach/videos` — sem presigned upload direto para MinIO | Simplifica autorização e validação de tamanho/duração no backend antes do upload |
| Duração máxima | 60s verificado pelo backend (rejeita se `duracao_segundos > 60`) | Controle de custo de armazenamento e tempo de revisão pelo personal |
| Feedback em áudio | MinIO bucket `coach-audios/` privado, presigned URL na resposta | Personal pode gravar feedback verbal rapidamente sem digitar |

**Extensão da entidade `mensagem` no Chat Context para suportar o feedback:**

```sql
ALTER TABLE mensagem
  ADD COLUMN tipo VARCHAR(30) DEFAULT 'TEXTO',
  ADD COLUMN dados_extras JSONB;
-- tipo: TEXTO | COACH_FEEDBACK
-- dados_extras para COACH_FEEDBACK: { coach_video_id, video_presigned_url, audio_presigned_url, exercicio_nome }
```

---

### 20.6 Plano de Treino por Objetivo com IA (Claude API)

**Fase:** 3  
**Bounded Context:** Training (geração e persistência) + Identity (dados do aluno via Anamnese)

#### Descrição

O personal clica em "Gerar Ficha com IA" ao criar uma ficha. O backend monta um prompt estruturado com os dados do aluno (nível da anamnese, objetivo, dias disponíveis, equipamentos) e chama a Claude API com `claude-sonnet-4-6`. A resposta é uma estrutura JSON de ficha que é apresentada como rascunho editável no `FichaBuilder`. O personal obrigatoriamente revisa antes de salvar. Todas as chamadas têm custos registrados na tabela `ia_usage`.

#### Modelo de Dados

```mermaid
erDiagram
    IA_USAGE {
        uuid id PK
        uuid personal_id FK "not null"
        uuid aluno_id FK "nullable — contexto da geração"
        string modelo "claude-sonnet-4-6"
        string operacao "GERAR_FICHA"
        int prompt_tokens "not null"
        int completion_tokens "not null"
        decimal custo_estimado_usd "precision 8,6 — not null"
        boolean cache_hit "true se prompt foi servido do cache"
        int cache_read_tokens "nullable — tokens lidos do cache"
        enum resultado "SUCESSO|FALLBACK|ERRO"
        timestamp criado_em "default now()"
    }

    FICHA_TREINO {
        uuid id PK
        boolean gerada_por_ia "default false"
        uuid ia_usage_id "nullable — referência ao registro de custo"
    }

    IA_USAGE }|--o| FICHA_TREINO : "originou"
```

#### Endpoint

```yaml
  /fichas/gerar-ia:
    post:
      tags: [Fichas, IA]
      summary: Gerar rascunho de ficha via Claude API
      description: |
        Gera estrutura de ficha com base no perfil do aluno.
        Retorna rascunho editável — nunca salva automaticamente.
        Em caso de falha na Claude API, retorna templates estáticos como fallback.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [aluno_id, equipamentos]
              properties:
                aluno_id:
                  type: string
                  format: uuid
                equipamentos:
                  type: string
                  enum: [ACADEMIA_COMPLETA, APENAS_HALTERES, PESO_CORPORAL]
                dias_disponiveis:
                  type: integer
                  minimum: 2
                  maximum: 6
                  default: 3
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  origem:       { type: string, enum: [IA, TEMPLATE_FALLBACK] }
                  rascunho:     { $ref: "#/components/schemas/FichaRascunhoIA" }
                  ia_usage_id:  { type: string, format: uuid, nullable: true }
        "422":
          $ref: "#/components/responses/ValidationError"
```

#### Fluxo Principal

```mermaid
sequenceDiagram
    participant PT as Personal (Web)
    participant API as AMFIT API
    participant PG as PostgreSQL
    participant CLAUDE as Claude API (Anthropic)

    PT->>API: POST /fichas/gerar-ia { aluno_id, equipamentos, dias_disponiveis }

    API->>PG: SELECT anamnese WHERE aluno_id=? (nivel_sugerido, objetivo, respostas_json)
    PG-->>API: AnamnesesResponse

    API->>CLAUDE: POST /v1/messages com prompt caching
    Note over API,CLAUDE: system prompt fixo marcado com cache_control: ephemeral<br/>(2048+ tokens — elegível para prompt caching)
    Note over API,CLAUDE: user message: dados específicos do aluno (não cacheados)

    alt Claude API responde com sucesso
        CLAUDE-->>API: JSON estruturado com treinos A/B/C + exercícios
        API->>API: Parseia e valida estrutura da resposta
        API->>PG: INSERT ia_usage (tokens, custo, cache_hit=true/false)
        API-->>PT: 200 { origem: IA, rascunho: FichaRascunhoIA }
    else Claude API falha (timeout, rate limit, erro 5xx)
        API->>PG: SELECT template_treino WHERE nivel=? AND objetivo~=?
        PG-->>API: template mais adequado
        API->>PG: INSERT ia_usage (resultado=FALLBACK)
        API-->>PT: 200 { origem: TEMPLATE_FALLBACK, rascunho: FichaRascunhoIA }
    end

    PT->>PT: Edita rascunho no FichaBuilder (adiciona, remove, ajusta exercícios)
    PT->>API: POST /fichas { ...rascunho_editado, gerada_por_ia: true, ia_usage_id }
    API-->>PT: 201 FichaResponse
```

#### Pseudocódigo Go — Claude API com Prompt Caching

```go
// internal/training/application/gerar_ficha_ia.go

package application

import (
    "context"
    "encoding/json"
    "fmt"

    anthropic "github.com/anthropics/anthropic-sdk-go"
    "github.com/anthropics/anthropic-sdk-go/option"
)

const systemPromptGerarFicha = `Você é um especialista em prescrição de treino de musculação.
Dado o perfil de um aluno (nível, objetivo, equipamentos disponíveis e dias por semana),
gere uma ficha de treino completa em formato JSON.

A resposta deve ser EXCLUSIVAMENTE um JSON válido com a seguinte estrutura:
{
  "treinos": [
    {
      "letra": "A",
      "nome": "Peito e Tríceps",
      "exercicios": [
        {
          "nome": "Supino Reto com Barra",
          "grupo_muscular": "Peitoral",
          "series": 4,
          "repeticoes": "8-12",
          "carga_sugerida_kg": 60,
          "descanso_segundos": 90,
          "observacao": "Escápulas retraídas durante todo o movimento"
        }
      ]
    }
  ]
}

Regras:
- Número de treinos deve corresponder aos dias disponíveis informados
- Exercícios compostos devem preceder isolados
- Iniciantes: 3-4 exercícios por treino, 3 séries, 12-15 reps
- Intermediários: 4-5 exercícios por treino, 3-4 séries, 8-12 reps
- Avançados: 5-6 exercícios por treino, 4-5 séries, 6-12 reps
- Nunca inclua dados pessoais do aluno na resposta
- Retorne APENAS o JSON, sem markdown, sem explicações`
// systemPromptGerarFicha tem ~350 tokens — concatenar com regras adicionais para
// atingir 2048+ tokens necessários para prompt caching ser elegível.

type GerarFichaIAInput struct {
    AlunoID         string
    NivelAluno      string // INICIANTE | INTERMEDIARIO | AVANCADO
    Objetivo        string
    DiasDisponiveis int
    Equipamentos    string // ACADEMIA_COMPLETA | APENAS_HALTERES | PESO_CORPORAL
}

type GerarFichaIAUseCase struct {
    client    *anthropic.Client
    iaUsageRepo IAUsageRepository
}

func NewGerarFichaIAUseCase(apiKey string, repo IAUsageRepository) *GerarFichaIAUseCase {
    client := anthropic.NewClient(option.WithAPIKey(apiKey))
    return &GerarFichaIAUseCase{client: client, iaUsageRepo: repo}
}

func (uc *GerarFichaIAUseCase) Execute(ctx context.Context, input GerarFichaIAInput) (*FichaRascunhoIA, *IAUsageRecord, error) {
    userMessage := fmt.Sprintf(
        "Gere uma ficha de treino para um aluno com o seguinte perfil:\n"+
            "- Nível: %s\n"+
            "- Objetivo: %s\n"+
            "- Dias disponíveis por semana: %d\n"+
            "- Equipamentos disponíveis: %s",
        input.NivelAluno,
        input.Objetivo,
        input.DiasDisponiveis,
        input.Equipamentos,
    )

    resp, err := uc.client.Messages.New(ctx, anthropic.MessageNewParams{
        Model:     anthropic.F(anthropic.ModelClaude_Sonnet_4_6),
        MaxTokens: anthropic.Int(4096),
        System: anthropic.F([]anthropic.TextBlockParam{
            {
                Type: anthropic.F(anthropic.TextBlockParamTypeText),
                Text: anthropic.String(systemPromptGerarFicha),
                // Marca o system prompt para cache — reutilizado em todas as chamadas
                // de geração de ficha, poupando ~2048+ tokens por request
                CacheControl: anthropic.F(anthropic.CacheControlEphemeralParam{
                    Type: anthropic.F(anthropic.CacheControlEphemeralTypeEphemeral),
                }),
            },
        }),
        Messages: anthropic.F([]anthropic.MessageParam{
            anthropic.UserMessage(userMessage),
        }),
    })
    if err != nil {
        return nil, nil, fmt.Errorf("claude api: %w", err)
    }

    // Extrai o conteúdo texto da resposta
    var rawJSON string
    for _, block := range resp.Content {
        if block.Type == anthropic.ContentBlockTypeText {
            rawJSON = block.Text
            break
        }
    }

    var rascunho FichaRascunhoIA
    if err := json.Unmarshal([]byte(rawJSON), &rascunho); err != nil {
        return nil, nil, fmt.Errorf("parsear resposta ia: %w", err)
    }

    // Registra uso e custo estimado
    usage := &IAUsageRecord{
        Modelo:             string(anthropic.ModelClaude_Sonnet_4_6),
        Operacao:           "GERAR_FICHA",
        PromptTokens:       int(resp.Usage.InputTokens),
        CompletionTokens:   int(resp.Usage.OutputTokens),
        CacheReadTokens:    int(resp.Usage.CacheReadInputTokens),
        CacheHit:           resp.Usage.CacheReadInputTokens > 0,
        CustoEstimadoUSD:   calcularCusto(resp.Usage),
        Resultado:          "SUCESSO",
    }
    if err := uc.iaUsageRepo.Save(ctx, usage); err != nil {
        // Não falha a operação principal por erro de log de custo
        slog.Warn("salvar ia_usage falhou", "err", err)
    }

    return &rascunho, usage, nil
}

func calcularCusto(usage anthropic.Usage) float64 {
    // claude-sonnet-4-6: $3/MTok input, $15/MTok output, $0.30/MTok cache read
    inputCost  := float64(usage.InputTokens)            / 1_000_000 * 3.00
    outputCost := float64(usage.OutputTokens)           / 1_000_000 * 15.00
    cacheCost  := float64(usage.CacheReadInputTokens)   / 1_000_000 * 0.30
    return inputCost + outputCost + cacheCost
}
```

#### Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Modelo | `claude-sonnet-4-6` | Balanceamento custo/qualidade para geração estruturada; haiku seria insuficiente para resposta JSON complexa; opus é desnecessário |
| Prompt caching | `cache_control: ephemeral` no system prompt | System prompt tem ~2500 tokens fixos; cache reduz custo em ~90% nas chamadas subsequentes e latência em ~50% |
| Formato de resposta | JSON puro (sem markdown) | Parsear diretamente com `json.Unmarshal`; instrução explícita no prompt evita ```json``` wrappers |
| Revisão obrigatória | Retorna rascunho, nunca salva automaticamente | Responsabilidade técnica: IA pode sugerir exercícios inapropriados para restrições específicas do aluno |
| Fallback | Templates estáticos do `template_treino` | Degrada graciosamente sem impacto visível para o personal |
| Controle de custos | Tabela `ia_usage` com todos os campos de uso | Permite dashboard de custos por personal, por período, e detecção de abusos |

---

### 20.7 Integração com Wearables (Apple Health + Google Health Connect)

**Fase:** 4  
**Bounded Context:** Execution (dados biométricos da sessão)

#### Descrição

Após concluir uma sessão, o app lê dados do período `iniciado_em → concluido_em` nas APIs de saúde do SO: frequência cardíaca média e máxima, e calorias ativas queimadas. Os dados são enviados ao backend via `PATCH /sessoes/{id}/biometrics`. A integração requer **Expo Bare Workflow** (development build) pois as bibliotecas acessam APIs nativas não disponíveis no Managed Workflow.

#### Restrição Arquitetural: Bare Workflow

Esta feature implica migração do Expo Managed Workflow para Bare Workflow para o app mobile. O impacto é:
- EAS Build continua funcionando, mas requer configuração nativa (Xcode/Android Studio) para módulos adicionais.
- Não afeta o servidor nem o portal web.
- Deve ser planejada como uma iteração isolada — não misturar com outras features de Fase 4.

#### Modelo de Dados

```mermaid
erDiagram
    SESSAO_BIOMETRICS {
        uuid id PK
        uuid sessao_id FK "not null — UK"
        int fc_media "nullable — bpm"
        int fc_maxima "nullable — bpm"
        int calorias_ativas "nullable — kcal"
        enum fonte "APPLE_HEALTH|GOOGLE_HEALTH_CONNECT"
        timestamp sincronizado_em "default now()"
    }

    SESSAO_TREINO ||--o| SESSAO_BIOMETRICS : "possui"
```

#### Fluxo Principal

```mermaid
sequenceDiagram
    participant APP as App Mobile (Bare Workflow)
    participant HEALTH as HealthKit / Health Connect
    participant API as AMFIT API
    participant PG as PostgreSQL

    Note over APP: Usuário ativa integração nas Configurações (não no primeiro login)

    APP->>HEALTH: Solicita permissão de leitura (FC + calorias)
    HEALTH-->>APP: Permissão concedida pelo usuário

    Note over APP: Ao concluir sessão (PATCH /sessoes/{id}/concluir retornou 200)

    APP->>HEALTH: Lê amostras de FC entre sessao.iniciado_em e sessao.concluido_em
    HEALTH-->>APP: Array de amostras { timestamp, bpm }

    APP->>APP: Calcula fc_media = média das amostras; fc_maxima = max das amostras
    APP->>HEALTH: Lê calorias ativas no mesmo período
    HEALTH-->>APP: calorias_ativas (kcal)

    APP->>API: PATCH /sessoes/{id}/biometrics { fc_media, fc_maxima, calorias_ativas, fonte }
    API->>PG: UPSERT sessao_biometrics
    API-->>APP: 200 OK

    Note over APP: Exibe métricas cardíacas na tela de detalhe da sessão
```

#### Endpoint

```yaml
  /sessoes/{id}/biometrics:
    patch:
      tags: [Sessoes]
      summary: Registrar dados biométricos de wearable na sessão
      parameters:
        - $ref: "#/components/parameters/IdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [fonte]
              properties:
                fc_media:        { type: integer, minimum: 30, maximum: 250, nullable: true }
                fc_maxima:       { type: integer, minimum: 30, maximum: 250, nullable: true }
                calorias_ativas: { type: integer, minimum: 0, nullable: true }
                fonte:
                  type: string
                  enum: [APPLE_HEALTH, GOOGLE_HEALTH_CONNECT]
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SessaoBiometricsResponse"
        "404":
          $ref: "#/components/responses/NotFound"
```

#### Bibliotecas e Configuração

| Plataforma | Biblioteca | Permissão requerida |
|---|---|---|
| iOS (HealthKit) | `react-native-health` | `NSHealthShareUsageDescription` no `Info.plist` |
| Android (Health Connect) | `react-native-health-connect` | `android.permission.health.READ_HEART_RATE`, `READ_ACTIVE_CALORIES_BURNED` no `AndroidManifest.xml` |

**Política de solicitação de permissão:**

A permissão é solicitada apenas quando o aluno acessa a tela **Configurações → Integração com Wearables** e toca em "Ativar". Nunca na primeira abertura do app. O estado de ativação é armazenado no `AsyncStorage` como `wearable_integration_enabled: boolean`.

#### Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Apple Watch direto | Descartado | Exige WatchOS extension, Swift nativo, Expo Bare Workflow exclusivo — custo de desenvolvimento desproporcional ao MVP |
| Apple Health (HealthKit) | Adotado | Consolida dados de qualquer wearable (Apple Watch, Garmin via Health) — uma única integração cobre múltiplos dispositivos |
| Google Health Connect | Adotado | Substitui Google Fit (deprecated 2025); consolida dados de Wear OS, Garmin, Fitbit via Android |
| Permissão lazy | Solicitada na tela de configurações | Solicitar permissões sensíveis de saúde na primeira abertura gera fricção e alta taxa de rejeição |
| `PATCH` separado para biometrics | Endpoint dedicado `PATCH /sessoes/{id}/biometrics` | A leitura do Health ocorre de forma assíncrona após a conclusão da sessão — não deve bloquear o fluxo principal do Player |

```mermaid
sequenceDiagram
    participant APP as App / Web
    participant API as AMFIT API
    participant PG as PostgreSQL

    APP->>API: POST /auth/login {email, senha, tipo}
    API->>PG: SELECT credencial WHERE email=?
    PG-->>API: credencial (hash)
    API->>API: bcrypt.Compare(senha, hash)
    API->>PG: INSERT refresh_token (jti, owner_id, expira_em)
    API-->>APP: { access_token (15min), Set-Cookie: refresh_token (httpOnly, 30d) }

    Note over APP,API: access_token expira

    APP->>API: POST /auth/refresh (Cookie: refresh_token)
    API->>PG: SELECT refresh_token WHERE jti=? AND NOT revogado
    API->>PG: UPDATE refresh_token SET revogado=true (rotation)
    API->>PG: INSERT novo refresh_token
    API-->>APP: { novo access_token, Set-Cookie: novo refresh_token }
```

---

## Apêndice B — Estrutura do Módulo Go (exemplo: catalog)

```
internal/catalog/
├── domain/
│   ├── exercicio.go          # Entity + Value Objects
│   ├── grupo_muscular.go
│   └── repository.go         # Interface (port)
├── application/
│   ├── criar_exercicio.go    # Use Case
│   ├── listar_exercicios.go
│   └── dto.go                # Request/Response DTOs da camada de app
├── infrastructure/
│   ├── postgres_repository.go  # Adapter (implementa domain.Repository)
│   └── minio_storage.go        # Adapter para upload de mídia
└── handlers/
    ├── exercicio_handler.go    # Fiber handler — chama use cases
    └── routes.go               # Registro de rotas
```

```go
// internal/catalog/domain/repository.go
package domain

import "context"

type ExercicioRepository interface {
    Create(ctx context.Context, e *Exercicio) error
    FindByID(ctx context.Context, id string) (*Exercicio, error)
    FindByPersonal(ctx context.Context, personalID string, grupoID *string) ([]*Exercicio, error)
    FindGlobais(ctx context.Context, grupoID *string) ([]*Exercicio, error)
    Update(ctx context.Context, e *Exercicio) error
}

type MediaStorage interface {
    Upload(ctx context.Context, bucket, key string, data []byte, contentType string) (string, error)
    PresignedURL(ctx context.Context, bucket, key string) (string, error)
}
```
