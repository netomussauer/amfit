import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessao } from '../hooks/useSessao';
import { makeSerie, makeSessao, makeTreino } from '../test-utils/fixtures';
import { TreinoConcluidoResumo } from './TreinoConcluidoResumo';

vi.mock('../hooks/useSessao');

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedUseSessao = vi.mocked(useSessao);

function mockSessao(data: ReturnType<typeof makeSessao> | undefined, isLoading = false) {
  mockedUseSessao.mockReturnValue({ data, isLoading } as unknown as ReturnType<
    typeof useSessao
  >);
}

function valorDe(label: string): string {
  const linha = screen.getByText(label).parentElement as HTMLElement;
  return linha.querySelector('p:last-child')?.textContent ?? '';
}

describe('TreinoConcluidoResumo', () => {
  beforeEach(() => {
    mockedUseSessao.mockReset();
  });

  it('mostra apenas o spinner enquanto carrega', () => {
    mockSessao(undefined, true);

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(screen.queryByText('Treino concluído!')).not.toBeInTheDocument();
  });

  it('consulta a sessao pelo id recebido', () => {
    mockSessao(makeSessao());

    render(<TreinoConcluidoResumo sessaoId="sessao-xyz" />);

    expect(mockedUseSessao).toHaveBeenCalledWith('sessao-xyz');
  });

  it('exibe letra e nome do treino, e o link de volta ao inicio', () => {
    mockSessao(makeSessao({ treino: makeTreino({ letra: 'B', nome: 'Costas' }) }));

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(screen.getByRole('heading', { name: 'Treino concluído!' })).toBeInTheDocument();
    expect(screen.getByText('Treino B · Costas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para início' })).toHaveAttribute(
      'href',
      '/treino',
    );
  });

  it('omite o nome quando o treino nao tem nome', () => {
    mockSessao(makeSessao({ treino: makeTreino({ letra: 'C', nome: null }) }));

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(screen.getByText('Treino C')).toBeInTheDocument();
  });

  it('conta so as series concluidas e soma carga x repeticoes delas', () => {
    mockSessao(
      makeSessao({
        concluido_em: '2026-10-26T10:45:00.000Z',
        series: [
          makeSerie({ id: '1', concluida: true, carga_realizada: 50, repeticoes_realizadas: 10 }),
          makeSerie({ id: '2', concluida: true, carga_realizada: 60, repeticoes_realizadas: 8 }),
          // nao concluida: ignorada mesmo com carga e reps preenchidas
          makeSerie({ id: '3', concluida: false, carga_realizada: 100, repeticoes_realizadas: 10 }),
          // concluida sem carga/reps (peso corporal): conta como serie, soma 0
          makeSerie({ id: '4', concluida: true, carga_realizada: null, repeticoes_realizadas: null }),
        ],
      }),
    );

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(valorDe('Séries concluídas')).toBe('3');
    expect(valorDe('Carga total movimentada')).toBe('980 kg');
  });

  it.each([
    [0, '0 kg'],
    [42.5, '42,5 kg'],
    [1000, '1,0 t'],
    [2600, '2,6 t'],
  ])('formata carga total de %s kg como "%s"', (total, esperado) => {
    mockSessao(
      makeSessao({
        series: [makeSerie({ concluida: true, carga_realizada: total, repeticoes_realizadas: 1 })],
      }),
    );

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(valorDe('Carga total movimentada')).toBe(esperado);
  });

  it.each([
    ['2026-10-26T10:45:00.000Z', '45 min'],
    ['2026-10-26T11:05:00.000Z', '1h 5min'],
    ['2026-10-26T12:30:00.000Z', '2h 30min'],
    ['2026-10-26T09:00:00.000Z', '0 min'], // concluido "antes" do inicio: nunca negativo
  ])('formata a duracao ate %s como "%s"', (concluidoEm, esperado) => {
    mockSessao(makeSessao({ concluido_em: concluidoEm }));

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(valorDe('Duração')).toBe(esperado);
  });

  it('mostra traco na duracao quando a sessao ainda nao foi concluida', () => {
    mockSessao(makeSessao({ concluido_em: null }));

    render(<TreinoConcluidoResumo sessaoId="s1" />);

    expect(valorDe('Duração')).toBe('—');
  });
});
