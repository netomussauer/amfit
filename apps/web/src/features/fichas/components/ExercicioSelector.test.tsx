import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExercicioListResponse, GrupoMuscular } from '@amfit/shared';
import { useExercicios } from '@/features/exercicios/hooks/useExercicios';
import { useGruposMusculares } from '@/features/exercicios/hooks/useGruposMusculares';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { ExercicioSelector } from './ExercicioSelector';

polyfillDialogElement();

vi.mock('@/features/exercicios/hooks/useExercicios');
vi.mock('@/features/exercicios/hooks/useGruposMusculares');
vi.mock('@/features/exercicios/components/MidiaPreview', () => ({
  MidiaPreview: ({ alt }: { alt: string }) => (
    <div data-testid="midia-preview-mock">Mídia: {alt}</div>
  ),
}));

const mockedUseExercicios = vi.mocked(useExercicios);
const mockedUseGruposMusculares = vi.mocked(useGruposMusculares);

function mockUseExerciciosReturn(overrides: Partial<ReturnType<typeof useExercicios>>) {
  mockedUseExercicios.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useExercicios>);
}

function mockUseGruposMuscularesReturn(
  overrides: Partial<ReturnType<typeof useGruposMusculares>>,
) {
  mockedUseGruposMusculares.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useGruposMusculares>);
}

const gruposFixture: GrupoMuscular[] = [
  { id: 'grupo-1', nome: 'Peito' },
  { id: 'grupo-2', nome: 'Costas' },
];

const exerciciosFixture: ExercicioListResponse = {
  data: [
    {
      id: 'ex-1',
      nome: 'Supino reto',
      grupo_muscular: gruposFixture[0],
      is_global: true,
    },
    {
      id: 'ex-2',
      nome: 'Remada curvada',
      grupo_muscular: gruposFixture[1],
      is_global: true,
    },
  ],
};

describe('ExercicioSelector', () => {
  beforeEach(() => {
    mockedUseExercicios.mockReset();
    mockedUseGruposMusculares.mockReset();
    mockUseGruposMuscularesReturn({ data: gruposFixture });
  });

  it('nao renderiza o dialog aberto quando open e false', () => {
    mockUseExerciciosReturn({ data: exerciciosFixture });

    const { container } = render(
      <ExercicioSelector open={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseExerciciosReturn({ isLoading: true });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByText('Carregando exercícios...')).toBeInTheDocument();
  });

  it('exibe mensagem de erro quando isError e true', () => {
    mockUseExerciciosReturn({ isError: true });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a lista de exercícios.',
    );
  });

  it('exibe mensagem de vazio quando nao ha exercicios', () => {
    mockUseExerciciosReturn({ data: { data: [] } });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByText('Nenhum exercício encontrado.')).toBeInTheDocument();
  });

  it('renderiza um cartao por exercicio e as opcoes de grupo muscular', () => {
    mockUseExerciciosReturn({ data: exerciciosFixture });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Selecionar Supino reto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Selecionar Remada curvada' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Peito' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Costas' })).toBeInTheDocument();
  });

  it('chama onSelect com o exercicio escolhido', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockUseExerciciosReturn({ data: exerciciosFixture });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Selecionar Supino reto' }));

    expect(onSelect).toHaveBeenCalledWith(exerciciosFixture.data[0]);
  });

  it('busca exercicios repassando o termo digitado (apos debounce) para o hook', async () => {
    const user = userEvent.setup();
    mockUseExerciciosReturn({ data: exerciciosFixture });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText(/buscar/i), 'Supino');

    await waitFor(() =>
      expect(mockedUseExercicios).toHaveBeenLastCalledWith({
        busca: 'Supino',
        grupo_muscular_id: undefined,
      }),
    );
  });

  it('filtra por grupo muscular selecionado', async () => {
    const user = userEvent.setup();
    mockUseExerciciosReturn({ data: exerciciosFixture });

    render(<ExercicioSelector open onClose={vi.fn()} onSelect={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/grupo muscular/i), 'grupo-1');

    expect(mockedUseExercicios).toHaveBeenLastCalledWith({
      busca: undefined,
      grupo_muscular_id: 'grupo-1',
    });
  });
});
