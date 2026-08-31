import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EvolucaoCargaPoint } from '../lib/chart-data';
import { EvolucaoCargaChart } from './EvolucaoCargaChart';

// O grafico (recharts/ResponsiveContainer) depende de medicoes de layout via
// ResizeObserver/getBoundingClientRect, que o jsdom nao fornece de forma
// realista (viewport 0x0). Por isso o teste aqui e um smoke test: garante
// que o componente monta sem lancar erro para os dados reais que ele recebe,
// e nao asserta sobre a estrutura interna do SVG gerado pela lib. O
// componente e explicitamente aria-hidden — a tabela de apoio renderizada
// por ProgressoExercicio e a fonte acessivel dos mesmos dados.
const pontosFixture: EvolucaoCargaPoint[] = [
  { sessaoId: 's1', data: '2026-01-10', cargaMaxima: 40, volumeTotal: 400, totalSeries: 3 },
  { sessaoId: 's2', data: '2026-01-17', cargaMaxima: 45, volumeTotal: 450, totalSeries: 3 },
];

describe('EvolucaoCargaChart', () => {
  it('monta sem lancar erro com uma serie de pontos valida', () => {
    const { container } = render(<EvolucaoCargaChart pontos={pontosFixture} />);

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('monta sem lancar erro quando nao ha pontos (lista vazia)', () => {
    const { container } = render(<EvolucaoCargaChart pontos={[]} />);

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('lida com sessoes sem carga maxima (null) sem quebrar', () => {
    const comNulo: EvolucaoCargaPoint[] = [
      { sessaoId: 's1', data: '2026-01-10', cargaMaxima: null, volumeTotal: 0, totalSeries: 1 },
    ];

    expect(() => render(<EvolucaoCargaChart pontos={comNulo} />)).not.toThrow();
  });
});
