import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AnamneseResponse } from '@amfit/shared';
import { useAnamnese } from '../hooks/useAnamnese';
import { AnamneseSection } from './AnamneseSection';

function makeAxiosError(status: number) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data: {},
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

vi.mock('../hooks/useAnamnese');

// Isola o teste da renderizacao real do formulario e do card de sugestao —
// cobertos separadamente em AnamneseForm.test.tsx e TemplateSugestaoCard.test.tsx.
vi.mock('./AnamneseForm', () => ({
  AnamneseForm: ({ onSuccess, onCancel }: { onSuccess: (r: unknown) => void; onCancel: () => void }) => (
    <div data-testid="anamnese-form-mock">
      <button type="button" onClick={() => onSuccess(resultadoMock)}>
        submit-mock
      </button>
      <button type="button" onClick={onCancel}>
        cancel-mock
      </button>
    </div>
  ),
}));

vi.mock('./TemplateSugestaoCard', () => ({
  TemplateSugestaoCard: ({ templateNome }: { templateNome: string }) => (
    <div data-testid="template-sugestao-mock">{templateNome}</div>
  ),
}));

const mockedUseAnamnese = vi.mocked(useAnamnese);

function mockUseAnamneseReturn(overrides: Partial<ReturnType<typeof useAnamnese>>) {
  mockedUseAnamnese.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAnamnese>);
}

const anamneseFixture: AnamneseResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  aluno_id: 'aluno-1',
  objetivo: 'Ganhar massa magra',
  pratica_outro_esporte: false,
  respostas: {
    frequencia_semanal: { opcao: '3-4 dias/semana', pontos: 20 },
    experiencia_meses: { opcao: '6 meses a 2 anos', pontos: 15 },
    objetivo: { opcao: 'Hipertrofia', pontos: 10 },
    restricoes: { opcao: 'Não', pontos: 0 },
    disponibilidade: { opcao: '3 dias', pontos: 5 },
  },
  score_calculado: 50,
  nivel_sugerido: 'INTERMEDIARIO',
  preenchido_em: '2026-05-11T16:46:15Z',
  atualizado_em: '2026-05-11T16:46:15Z',
};

const resultadoMock: AnamneseResponse = {
  ...anamneseFixture,
  template_ficha_id: '22222222-2222-2222-2222-222222222222',
  template_ficha_nome: 'Hipertrofia AB Intermediário',
};

describe('AnamneseSection', () => {
  beforeEach(() => {
    mockedUseAnamnese.mockReset();
  });

  it('exibe skeleton enquanto carrega', () => {
    mockUseAnamneseReturn({ isLoading: true });

    const { container } = render(<AnamneseSection alunoId="aluno-1" />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha por um motivo inesperado', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseAnamneseReturn({
      isError: true,
      error: makeAxiosError(500),
      refetch,
    });

    render(<AnamneseSection alunoId="aluno-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a anamnese.');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe o CTA de preencher quando a anamnese ainda não existe (404)', async () => {
    const user = userEvent.setup();
    mockUseAnamneseReturn({
      isError: true,
      error: makeAxiosError(404),
    });

    render(<AnamneseSection alunoId="aluno-1" />);

    expect(
      screen.getByText('Este aluno ainda não tem uma anamnese registrada.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /preencher anamnese/i }));
    expect(screen.getByTestId('anamnese-form-mock')).toBeInTheDocument();
  });

  it('mostra o resumo quando já existe uma anamnese registrada', () => {
    mockUseAnamneseReturn({ data: anamneseFixture });

    render(<AnamneseSection alunoId="aluno-1" />);

    expect(screen.getByText('Ganhar massa magra')).toBeInTheDocument();
    expect(screen.queryByTestId('template-sugestao-mock')).not.toBeInTheDocument();
  });

  it('mostra o card de sugestão de template logo após salvar (não vem do GET)', async () => {
    const user = userEvent.setup();
    mockUseAnamneseReturn({
      isError: true,
      error: makeAxiosError(404),
    });

    render(<AnamneseSection alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /preencher anamnese/i }));
    await user.click(screen.getByText('submit-mock'));

    expect(screen.getByTestId('template-sugestao-mock')).toHaveTextContent(
      'Hipertrofia AB Intermediário',
    );
  });

  it('reabre o formulario ao clicar em reavaliar', async () => {
    const user = userEvent.setup();
    mockUseAnamneseReturn({ data: anamneseFixture });

    render(<AnamneseSection alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /reavaliar anamnese/i }));

    expect(screen.getByTestId('anamnese-form-mock')).toBeInTheDocument();
  });
});
