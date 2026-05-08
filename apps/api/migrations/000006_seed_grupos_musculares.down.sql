-- Migration: 000006_seed_grupos_musculares (down)
-- Remove apenas os grupos musculares semeados; preserva eventuais
-- registros adicionados manualmente.

DELETE FROM grupo_muscular WHERE nome IN (
    'Peitoral',
    'Costas',
    'Ombros',
    'Tríceps',
    'Bíceps',
    'Antebraço',
    'Quadríceps',
    'Posterior de coxa',
    'Glúteo',
    'Panturrilha',
    'Abdômen'
);
