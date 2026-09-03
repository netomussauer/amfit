import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemTreinoResponse } from '@amfit/shared';
import { ExercicioBlock } from './ExercicioBlock';
import { useSugestaoProgressao } from '@/features/meu-progresso';

// ExercicioBlock chama useSugestaoProgressao (useQuery por baixo) — mockado
// aqui pra não exigir um QueryClientProvider real nestes testes, que focam
// no layout/composição do bloco. O comportamento do hook em si é coberto
// em useSugestaoProgressao.test.ts.
vi.mock('@/features/meu-progresso', () => ({
  useSugestaoProgressao: vi.fn(),
}));

const mockedUseSugestaoProgressao = vi.mocked(useSugestaoProgressao);

function semSugestao() {
  return { data: undefined, isLoading: false } as ReturnType<typeof useSugestaoProgressao>;
}

function makeItem(overrides: Partial<ItemTreinoResponse> = {}): ItemTreinoResponse {
  return {
    id: '30000000-0000-0000-0000-000000000001',
    ordem: 0,
    exercicio: {
      id: '10000000-0000-0000-0000-000000000001',
      nome: 'Supino Reto',
      descricao: null,
      grupo_muscular: { id: '20000000-0000-0000-0000-000000000001', nome: 'Peito' },
      midia_url: null,
      tipo_midia: null,
      is_global: true,
    },
    series: 3,
    repeticoes: '10',
    carga_sugerida: 40,
    descanso_segundos: 60,
    observacao: null,
    ...overrides,
  };
}

describe('ExercicioBlock', () => {
  beforeEach(() => {
    mockedUseSugestaoProgressao.mockReset();
    mockedUseSugestaoProgressao.mockReturnValue(semSugestao());
  });

  it('exibe nome, grupo muscular e a carga_sugerida estatica quando nao ha sugestao computada', () => {
    const item = makeItem({ carga_sugerida: 40 });

    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={vi.fn()} />);

    expect(screen.getByText(item.exercicio.nome)).toBeInTheDocument();
    expect(screen.getByText(item.exercicio.grupo_muscular.nome)).toBeInTheDocument();
    expect(screen.getByText('Sugerida: 40 kg')).toBeInTheDocument();
  });

  it('nao exibe carga sugerida quando o item nao tem carga_sugerida nem sugestao computada', () => {
    const item = makeItem({ carga_sugerida: null });

    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={vi.fn()} />);

    expect(screen.queryByText(/Sugerida:/)).not.toBeInTheDocument();
  });

  it('usa a carga sugerida pelo calculo de progressao no lugar da carga_sugerida estatica, quando disponivel', () => {
    const item = makeItem({ carga_sugerida: 40 });
    mockedUseSugestaoProgressao.mockReturnValue({
      data: {
        exercicio_id: item.exercicio.id,
        tem_sugestao: true,
        direcao: 'AUMENTAR',
        carga_sugerida: 22.5,
        ultima_carga_registrada: 20,
        ultima_media_repeticoes: 10,
      },
      isLoading: false,
    } as ReturnType<typeof useSugestaoProgressao>);

    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={vi.fn()} />);

    expect(screen.getByText('Sugerida: 22,5 kg')).toBeInTheDocument();
    expect(screen.queryByText('Sugerida: 40 kg')).not.toBeInTheDocument();
  });

  it('cai de volta pra carga_sugerida estatica quando tem_sugestao=false', () => {
    const item = makeItem({ carga_sugerida: 40 });
    mockedUseSugestaoProgressao.mockReturnValue({
      data: { exercicio_id: item.exercicio.id, tem_sugestao: false },
      isLoading: false,
    } as ReturnType<typeof useSugestaoProgressao>);

    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={vi.fn()} />);

    expect(screen.getByText('Sugerida: 40 kg')).toBeInTheDocument();
  });

  it('conta corretamente as series concluidas em relacao ao total', () => {
    const item = makeItem({ series: 3 });
    const registros = [
      {
        id: '1',
        item_treino_id: item.id,
        numero_serie: 1,
        concluida: true,
        carga_realizada: null,
        repeticoes_realizadas: null,
      },
      {
        id: '2',
        item_treino_id: item.id,
        numero_serie: 2,
        concluida: false,
        carga_realizada: null,
        repeticoes_realizadas: null,
      },
    ];

    render(<ExercicioBlock item={item} registros={registros} onRegistrarSerie={vi.fn()} />);

    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('expande ao clicar no cabecalho e exibe a observacao do item', () => {
    const item = makeItem({ observacao: 'Manter cotovelos alinhados' });
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={vi.fn()} />);
    expect(screen.queryByText('Manter cotovelos alinhados')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByText('Manter cotovelos alinhados')).toBeInTheDocument();
  });
});
