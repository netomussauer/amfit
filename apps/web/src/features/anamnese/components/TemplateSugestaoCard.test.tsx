import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useCriarFichaFromTemplate } from '@/features/fichas';
import { TemplateSugestaoCard } from './TemplateSugestaoCard';

vi.mock('@/features/fichas', () => ({
  useCriarFichaFromTemplate: vi.fn(),
}));

const mockedPush = vi.fn();
const mockedRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockedPush,
    refresh: mockedRefresh,
  }),
}));

const mockedUseCriarFichaFromTemplate = vi.mocked(useCriarFichaFromTemplate);

function mockReturn(overrides: Partial<ReturnType<typeof useCriarFichaFromTemplate>>) {
  mockedUseCriarFichaFromTemplate.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarFichaFromTemplate>);
}

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

describe('TemplateSugestaoCard', () => {
  beforeEach(() => {
    mockedUseCriarFichaFromTemplate.mockReset();
    mockedPush.mockReset();
    mockedRefresh.mockReset();
    mockReturn({});
  });

  it('exibe o nome do template sugerido', () => {
    render(
      <TemplateSugestaoCard
        alunoId="aluno-1"
        templateId="template-1"
        templateNome="Hipertrofia AB Intermediário"
      />,
    );

    expect(screen.getByText('Hipertrofia AB Intermediário')).toBeInTheDocument();
  });

  it('aplica o template e navega para a ficha criada', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess({ id: 'ficha-1' });
    });
    mockReturn({ mutate });

    render(
      <TemplateSugestaoCard alunoId="aluno-1" templateId="template-1" templateNome="Template X" />,
    );

    await user.click(screen.getByRole('button', { name: /aplicar este template/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars).toMatchObject({ template_id: 'template-1', aluno_id: 'aluno-1' });
    expect(vars.vigencia_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockedPush).toHaveBeenCalledWith('/alunos/aluno-1/fichas/ficha-1');
  });

  it('navega para a criação de ficha do zero', async () => {
    const user = userEvent.setup();
    render(
      <TemplateSugestaoCard alunoId="aluno-1" templateId="template-1" templateNome="Template X" />,
    );

    await user.click(screen.getByRole('button', { name: /montar do zero/i }));

    expect(mockedPush).toHaveBeenCalledWith('/alunos/aluno-1/fichas/nova');
  });

  it('exibe mensagem de erro quando o template não pode ser aplicado (422)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(makeAxiosError(422));
    });
    mockReturn({ mutate });

    render(
      <TemplateSugestaoCard alunoId="aluno-1" templateId="template-1" templateNome="Template X" />,
    );

    await user.click(screen.getByRole('button', { name: /aplicar este template/i }));

    expect(
      screen.getByText(
        'Este template não pode ser aplicado (sem exercícios). Monte a ficha do zero.',
      ),
    ).toBeInTheDocument();
  });
});
