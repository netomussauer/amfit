'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComparativoFinanceiroResponse } from '@amfit/shared';
import { formatBRL, formatCompetenciaCurta } from '../lib/format';

type Props = {
  competencias: ComparativoFinanceiroResponse['data'];
};

/**
 * Gráfico de barras agrupadas: recebido vs. previsto por competência. A
 * taxa de inadimplência não entra aqui — é outra unidade (%), e um
 * segundo eixo escondendo duas escalas no mesmo gráfico é um anti-padrão
 * (ver skill de dataviz); ela fica só na tabela de apoio (renderizada por
 * quem consome este componente), que também garante acessibilidade a
 * leitores de tela.
 */
export function ComparativoFinanceiroChart({ competencias }: Props) {
  const dados = competencias.map((c) => ({
    ...c,
    label: formatCompetenciaCurta(c.ano, c.mes),
  }));

  return (
    <div
      aria-hidden="true"
      className="h-72 w-full rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            width={56}
            tickFormatter={(value) => formatBRL(Number(value))}
          />
          <Tooltip
            formatter={(value, name) => [formatBRL(Number(value)), name]}
            labelStyle={{ color: 'var(--color-text)' }}
            contentStyle={{
              borderRadius: 8,
              borderColor: 'var(--color-border)',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
          <Bar
            dataKey="total_previsto"
            name="Previsto"
            fill="var(--color-text-muted)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="receita_paga"
            name="Recebido"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
