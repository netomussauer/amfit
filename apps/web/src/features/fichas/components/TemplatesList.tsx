'use client';

import { useState } from 'react';
import type { TemplateResponse } from '@amfit/shared';
import { NIVEL_ANAMNESE_LABEL } from '@/features/anamnese';
import { useTemplates } from '../hooks/useTemplates';
import { AplicarTemplateModal } from './AplicarTemplateModal';

// Vocabulário diferente do de OPCOES_OBJETIVO_SCORING (anamnese/lib/opcoes) —
// aquele é a pergunta de scoring (EMAGRECIMENTO, CONDICIONAMENTO_GERAL...);
// este é o vocabulário mais compacto de template_treino.objetivo, sem
// equivalente já existente pra reaproveitar (ver SDD §20.2 sobre a tradução
// entre os dois).
const OBJETIVO_LABEL: Record<string, string> = {
  hipertrofia: 'Hipertrofia',
  emagrecimento: 'Emagrecimento',
  forca: 'Força',
  condicionamento: 'Condicionamento',
};

/**
 * Modelos de ficha disponíveis pro personal: os curados pelo sistema
 * (sugeridos pela anamnese, SDD §20.2) e os que o próprio personal salvou
 * a partir de uma ficha existente ("Salvar como modelo" no FichaBuilder).
 * Sem esta tela, um modelo salvo ficava sem nenhum jeito de ser
 * encontrado ou reaplicado depois de criado.
 */
export function TemplatesList() {
  const { data, isLoading, isError, refetch } = useTemplates();
  const [aplicando, setAplicando] = useState<TemplateResponse | null>(null);

  if (isLoading) {
    return <ListaSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar os modelos de ficha.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (data.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[--color-border] bg-[--color-bg] px-4 py-12 text-center">
        <p className="text-sm text-[--color-text-muted]">
          Nenhum modelo disponível ainda. Abra uma ficha existente e use &quot;Salvar como
          modelo&quot; para criar o primeiro.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {data.data.map((template) => (
          <li
            key={template.id}
            className="flex flex-col gap-3 rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-[--color-text]">{template.nome}</p>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                    template.criado_por === 'PERSONAL'
                      ? 'bg-[--color-primary]/10 text-[--color-primary-hover]'
                      : 'bg-[--color-bg-muted] text-[--color-text-muted]',
                  ].join(' ')}
                >
                  {template.criado_por === 'PERSONAL' ? 'Meu modelo' : 'Sistema'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[--color-text-muted]">
                {NIVEL_ANAMNESE_LABEL[template.nivel] ?? template.nivel} ·{' '}
                {OBJETIVO_LABEL[template.objetivo] ?? template.objetivo} · {template.itens.length}{' '}
                {template.itens.length === 1 ? 'exercício' : 'exercícios'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAplicando(template)}
              className="inline-flex items-center justify-center rounded-md border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:border-[--color-primary-hover] hover:text-[--color-primary-hover] sm:flex-shrink-0"
            >
              Aplicar a um aluno
            </button>
          </li>
        ))}
      </ul>

      {aplicando && (
        <AplicarTemplateModal template={aplicando} onClose={() => setAplicando(null)} />
      )}
    </>
  );
}

function ListaSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-lg border border-[--color-border] bg-[--color-bg-muted]"
        />
      ))}
    </div>
  );
}
