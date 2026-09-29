-- Migration: 000013_registro_serie_rpe
-- Onda 1, item 2 do discovery competitivo (SDD §20.8): campo de RPE
-- (Rate of Perceived Exertion, escala de Borg CR-10) por série registrada.
-- Nullable/opcional — o aluno pode continuar concluindo uma série sem
-- informar RPE, igual já acontece hoje com carga e repetições.

ALTER TABLE registro_serie
    ADD COLUMN rpe SMALLINT CHECK (rpe BETWEEN 1 AND 10);
