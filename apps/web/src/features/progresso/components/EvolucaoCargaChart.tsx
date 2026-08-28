'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EvolucaoCargaPoint } from '../lib/chart-data';
import { formatDataIso, formatNumero } from '../lib/chart-data';

type Props = {
  pontos: EvolucaoCargaPoint[];
};

/**
 * Gráfico de linha da carga máxima movimentada por sessão. O componente é
 * puramente visual — a tabela de apoio (renderizada por quem consome este
 * componente) garante que a mesma informação fique acessível a leitores
 * de tela, já que gráficos SVG não são bem suportados por eles.
 */
export function EvolucaoCargaChart({ pontos }: Props) {
  const dados = pontos.map((p) => ({
    ...p,
    dataLabel: formatDataIso(p.data),
  }));

  return (
    <div
      aria-hidden="true"
      className="h-72 w-full rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="dataLabel"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            width={36}
            allowDecimals
          />
          <Tooltip
            formatter={(value) => [`${formatNumero(Number(value))} kg`, 'Carga máxima']}
            labelStyle={{ color: 'var(--color-text)' }}
            contentStyle={{
              borderRadius: 8,
              borderColor: 'var(--color-border)',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="cargaMaxima"
            name="Carga máxima"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
