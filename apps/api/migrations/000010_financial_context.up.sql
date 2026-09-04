-- Migration: 000010_financial_context
-- Cria as tabelas do bounded context Financial (SDD docs/SDD.md §13.1 e
-- §16): plano contratado por aluno e as mensalidades geradas a partir dele.
--
-- Escopo desta entrega: cobranca manual. O personal marca o pagamento
-- (PIX/boleto/cartao/dinheiro) ele mesmo — sem integracao real com o
-- gateway Asaas ainda. Por isso a tabela `link_pagamento` do SDD (URL de
-- cobranca gerada pelo gateway) NAO existe nesta migration; os campos de
-- pagamento manual (valor_pago, data_pagamento, forma_pagamento) ja vivem
-- direto em `mensalidade`, entao adicionar `link_pagamento` depois (quando
-- houver conta Asaas configurada) nao vai exigir alterar esta tabela.
--
-- Geracao automatica de mensalidades e marcacao de atraso rodam via um
-- worker em Go (internal/financial/worker), no mesmo padrao do Notification
-- Dispatcher — nao via pg_cron (extensao nao garantida no Postgres de
-- producao). `lembrete_enviado` simplifica o job 3 do SDD (que dispara em
-- D-3/D-1/D0) para um unico aviso quando a mensalidade entra na janela de
-- 3 dias antes do vencimento — reduz risco de notificar 3x sem exigir
-- rastrear qual dos 3 toques ja foi enviado.

CREATE TYPE status_plano_aluno AS ENUM ('ATIVO', 'SUSPENSO', 'ENCERRADO');
CREATE TYPE status_mensalidade AS ENUM ('PENDENTE', 'PAGA', 'ATRASADA', 'CANCELADA', 'ISENTA');
CREATE TYPE forma_pagamento_mensalidade AS ENUM ('PIX', 'BOLETO', 'CARTAO', 'DINHEIRO');

CREATE TABLE plano_aluno (
    id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id         UUID                NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    personal_id      UUID                NOT NULL REFERENCES personal_trainer(id) ON DELETE CASCADE,
    valor_mensal     NUMERIC(10,2)       NOT NULL CHECK (valor_mensal > 0),
    dia_vencimento   INT                 NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
    vigencia_inicio  DATE                NOT NULL DEFAULT CURRENT_DATE,
    vigencia_fim     DATE,
    status           status_plano_aluno  NOT NULL DEFAULT 'ATIVO',
    observacao       TEXT,
    criado_em        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Só pode existir um plano ATIVO por aluno de cada vez — o service também
-- valida isso antes do INSERT, mas o índice garante a invariante mesmo sob
-- concorrência (duas requests criando plano pro mesmo aluno ao mesmo tempo).
CREATE UNIQUE INDEX idx_plano_aluno_ativo_unico ON plano_aluno(aluno_id) WHERE status = 'ATIVO';
CREATE INDEX idx_plano_aluno_personal ON plano_aluno(personal_id);

CREATE TABLE mensalidade (
    id                UUID                          PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id          UUID                          NOT NULL REFERENCES plano_aluno(id) ON DELETE CASCADE,
    aluno_id          UUID                          NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    competencia_ano   INT                           NOT NULL,
    competencia_mes   INT                           NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
    data_vencimento   DATE                          NOT NULL,
    valor             NUMERIC(10,2)                 NOT NULL CHECK (valor > 0),
    status            status_mensalidade            NOT NULL DEFAULT 'PENDENTE',
    valor_pago        NUMERIC(10,2),
    data_pagamento    DATE,
    forma_pagamento   forma_pagamento_mensalidade,
    observacao        TEXT,
    lembrete_enviado  BOOLEAN                       NOT NULL DEFAULT FALSE,
    criado_em         TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),

    -- Garante a idempotência do job de geração mensal: nunca duas
    -- mensalidades para a mesma competência do mesmo plano.
    UNIQUE (plano_id, competencia_ano, competencia_mes)
);

CREATE INDEX idx_mensalidade_aluno ON mensalidade(aluno_id);

-- Consultada pelo worker (marcar atrasadas + gerar lembretes) e pela
-- listagem paginada do personal filtrando por status.
CREATE INDEX idx_mensalidade_status_vencimento ON mensalidade(status, data_vencimento);
