-- Migration: 000012_personal_codigo
-- Codigo de convite do personal (white label nivel 2, SDD ADR-007 / §20.4):
-- 8 caracteres aleatorios que o aluno usa (link, QR ou digitado) para o app
-- buscar o branding publico do personal ANTES do login.
--
-- Fica em personal_trainer (sempre existe) e nao em tenant_config (so tem
-- linha depois que o personal configura algo).
--
-- Alfabeto de 31 caracteres, sem ambiguos (sem I, L, O, 0, 1) — o mesmo do
-- gerador em Go (identity/domain/codigo.go) e da regex do @amfit/shared.
-- O backfill usa bytes de gen_random_uuid() (builtin, sem extensao),
-- pulando os bytes 6 e 8 (versao/variante fixos do UUID v4).

ALTER TABLE personal_trainer ADD COLUMN codigo TEXT;

DO $$
DECLARE
    alfabeto CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    posicoes CONSTANT INT[] := ARRAY[0, 1, 2, 3, 4, 5, 9, 10];
    r        RECORD;
    novo     TEXT;
    bytes    BYTEA;
    pos      INT;
BEGIN
    FOR r IN SELECT id FROM personal_trainer WHERE codigo IS NULL LOOP
        LOOP
            bytes := uuid_send(gen_random_uuid());
            novo := '';
            FOREACH pos IN ARRAY posicoes LOOP
                novo := novo || substr(alfabeto, (get_byte(bytes, pos) % 31) + 1, 1);
            END LOOP;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM personal_trainer WHERE codigo = novo);
        END LOOP;
        UPDATE personal_trainer SET codigo = novo WHERE id = r.id;
    END LOOP;
END $$;

ALTER TABLE personal_trainer ALTER COLUMN codigo SET NOT NULL;
ALTER TABLE personal_trainer ADD CONSTRAINT personal_trainer_codigo_key UNIQUE (codigo);
