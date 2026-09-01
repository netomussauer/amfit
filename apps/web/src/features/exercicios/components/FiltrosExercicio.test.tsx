import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrupoMuscular } from '@amfit/shared';
import { useGruposMusculares } from '../hooks/useGruposMusculares';
import { FiltrosExercicio } from './FiltrosExercicio';

vi.mock('../hooks/useGruposMusculares');

const mockedUseGruposMusculares = vi.mocked(useGruposMusculares);

function mockGruposReturn(overrides: Partial<ReturnType<typeof useGruposMusculares>>) {
  mockedUseGruposMusculares.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useGruposMusculares>);
}

const gruposFixture: GrupoMuscular[] = [
  { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  { id: '22222222-2222-2222-2222-222222222222', nome: 'Costas' },
];

describe('FiltrosExercicio', () => {
  const onBuscaChange = vi.fn();
  const onGrupoMuscularChange = vi.fn();

  beforeEach(() => {
    mockedUseGruposMusculares.mockReset();
    onBuscaChange.mockReset();
    onGrupoMuscularChange.mockReset();
    mockGruposReturn({ data: gruposFixture });
  });

  it('exibe o valor atual de busca e grupo muscular', () => {
    render(
      <FiltrosExercicio
        busca="supino"
        grupoMuscularId={gruposFixture[0]!.id}
        onBuscaChange={onBuscaChange}
        onGrupoMuscularChange={onGrupoMuscularChange}
      />,
    );

    expect(screen.getByLabelText('Buscar')).toHaveValue('supino');
    expect(screen.getByLabelText('Grupo muscular')).toHaveValue(gruposFixture[0]!.id);
  });

  it('chama onBuscaChange ao digitar no campo de busca', async () => {
    const user = userEvent.setup();
    render(
      <FiltrosExercicio
        busca=""
        grupoMuscularId=""
        onBuscaChange={onBuscaChange}
        onGrupoMuscularChange={onGrupoMuscularChange}
      />,
    );

    await user.type(screen.getByLabelText('Buscar'), 'a');

    expect(onBuscaChange).toHaveBeenCalledWith('a');
  });

  it('chama onGrupoMuscularChange ao selecionar um grupo muscular', async () => {
    const user = userEvent.setup();
    render(
      <FiltrosExercicio
        busca=""
        grupoMuscularId=""
        onBuscaChange={onBuscaChange}
        onGrupoMuscularChange={onGrupoMuscularChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Grupo muscular'), 'Costas');

    expect(onGrupoMuscularChange).toHaveBeenCalledWith(gruposFixture[1]!.id);
  });

  it('desabilita o select de grupo muscular enquanto carrega', () => {
    mockGruposReturn({ isLoading: true });

    render(
      <FiltrosExercicio
        busca=""
        grupoMuscularId=""
        onBuscaChange={onBuscaChange}
        onGrupoMuscularChange={onGrupoMuscularChange}
      />,
    );

    expect(screen.getByLabelText('Grupo muscular')).toBeDisabled();
  });

  it('exibe mensagem de erro quando os grupos musculares falham ao carregar', () => {
    mockGruposReturn({ isError: true });

    render(
      <FiltrosExercicio
        busca=""
        grupoMuscularId=""
        onBuscaChange={onBuscaChange}
        onGrupoMuscularChange={onGrupoMuscularChange}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Falha ao carregar grupos musculares.',
    );
    expect(screen.getByLabelText('Grupo muscular')).toBeDisabled();
  });
});
