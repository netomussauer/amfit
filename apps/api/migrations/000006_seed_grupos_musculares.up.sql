-- Migration: 000006_seed_grupos_musculares
-- Popula grupo_muscular com a taxonomia base usada pela aplicação.
-- ON CONFLICT garante idempotência em ambientes onde a migration possa ser
-- reaplicada após edição manual da tabela.

INSERT INTO grupo_muscular (id, nome) VALUES
    (gen_random_uuid(), 'Peitoral'),
    (gen_random_uuid(), 'Costas'),
    (gen_random_uuid(), 'Ombros'),
    (gen_random_uuid(), 'Tríceps'),
    (gen_random_uuid(), 'Bíceps'),
    (gen_random_uuid(), 'Antebraço'),
    (gen_random_uuid(), 'Quadríceps'),
    (gen_random_uuid(), 'Posterior de coxa'),
    (gen_random_uuid(), 'Glúteo'),
    (gen_random_uuid(), 'Panturrilha'),
    (gen_random_uuid(), 'Abdômen')
ON CONFLICT (nome) DO NOTHING;
