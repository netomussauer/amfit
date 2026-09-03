import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useRegistrarAnamnese } from '../hooks/useRegistrarAnamnese';
import { AnamneseForm } from './AnamneseForm';

vi.mock('../hooks/useRegistrarAnamnese');

const mockedUseRegistrarAnamnese = vi.mocked(useRegistrarAnamnese);

function mockUseRegistrarAnamneseReturn(
  overrides: Partial<ReturnType<typeof useRegistrarAnamnese>>,
) {
  mockedUseRegistrarAnamnese.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRegistrarAnamnese>);
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

async function preencherCamposObrigatorios(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/objetivo \(descrição livre\)/i), 'Ganhar massa magra');
  await user.selectOptions(screen.getByLabelText(/frequência de treino atual/i), '3_4_dias');
  await user.selectOptions(screen.getByLabelText(/experiência com treino/i), '6_meses_2_anos');
  await user.selectOptions(screen.getByLabelText(/objetivo principal/i), 'hipertrofia');
  await user.selectOptions(screen.getByLabelText(/restrições médicas/i), 'nao');
  await user.selectOptions(screen.getByLabelText(/disponibilidade semanal/i), '3_dias');
}

describe('AnamneseForm', () => {
  beforeEach(() => {
    mockedUseRegistrarAnamnese.mockReset();
    mockUseRegistrarAnamneseReturn({});
  });

  it('renderiza os campos obrigatorios do formulario', () => {
    render(<AnamneseForm alunoId="aluno-1" onSuccess={vi.fn()} />);

    expect(screen.getByLabelText(/objetivo \(descrição livre\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/frequência de treino atual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/experiência com treino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/objetivo principal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/restrições médicas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/disponibilidade semanal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar anamnese/i })).toBeInTheDocument();
  });

  it('não exibe o campo "qual esporte" até marcar "pratica outro esporte"', async () => {
    const user = userEvent.setup();
    render(<AnamneseForm alunoId="aluno-1" onSuccess={vi.fn()} />);

    expect(screen.queryByLabelText(/qual esporte/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/pratica outro esporte/i));

    expect(screen.getByLabelText(/qual esporte/i)).toBeInTheDocument();
  });

  it('exibe erro nos 5 selects de scoring quando nenhum é selecionado', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseRegistrarAnamneseReturn({ mutate });

    render(<AnamneseForm alunoId="aluno-1" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/objetivo \(descrição livre\)/i), 'Ganhar massa magra');
    await user.click(screen.getByRole('button', { name: /salvar anamnese/i }));

    expect(await screen.findByText('Selecione a frequência de treino atual')).toBeInTheDocument();
    expect(screen.getByText('Selecione a experiência com treino')).toBeInTheDocument();
    expect(screen.getByText('Selecione o objetivo principal')).toBeInTheDocument();
    expect(screen.getByText('Informe se há restrições médicas')).toBeInTheDocument();
    expect(screen.getByText('Selecione a disponibilidade semanal')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submete o payload completo e chama onSuccess com o resultado', async () => {
    const user = userEvent.setup();
    const resultado = { id: 'anamnese-1', score_calculado: 50 };
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess(resultado);
    });
    mockUseRegistrarAnamneseReturn({ mutate });
    const onSuccess = vi.fn();

    render(<AnamneseForm alunoId="aluno-1" onSuccess={onSuccess} />);

    await preencherCamposObrigatorios(user);
    await user.click(screen.getByRole('button', { name: /salvar anamnese/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.alunoId).toBe('aluno-1');
    expect(vars.payload).toMatchObject({
      objetivo: 'Ganhar massa magra',
      pratica_outro_esporte: false,
      respostas: {
        frequencia_semanal: '3_4_dias',
        experiencia_meses: '6_meses_2_anos',
        objetivo: 'hipertrofia',
        restricoes: 'nao',
        disponibilidade: '3_dias',
      },
    });
    expect(onSuccess).toHaveBeenCalledWith(resultado);
  });

  it('inclui outro_esporte no payload quando pratica_outro_esporte é marcado', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onSuccess({}));
    mockUseRegistrarAnamneseReturn({ mutate });

    render(<AnamneseForm alunoId="aluno-1" onSuccess={vi.fn()} />);

    await preencherCamposObrigatorios(user);
    await user.click(screen.getByLabelText(/pratica outro esporte/i));
    await user.type(screen.getByLabelText(/qual esporte/i), 'Natação');
    await user.click(screen.getByRole('button', { name: /salvar anamnese/i }));

    const [vars] = mutate.mock.calls[0];
    expect(vars.payload).toMatchObject({
      pratica_outro_esporte: true,
      outro_esporte: 'Natação',
    });
  });

  it('exibe mensagem de erro generica quando a API retorna 422', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(makeAxiosError(422));
    });
    mockUseRegistrarAnamneseReturn({ mutate });

    render(<AnamneseForm alunoId="aluno-1" onSuccess={vi.fn()} />);

    await preencherCamposObrigatorios(user);
    await user.click(screen.getByRole('button', { name: /salvar anamnese/i }));

    expect(
      screen.getByText('Há campos inválidos no formulário. Revise e tente novamente.'),
    ).toBeInTheDocument();
  });

  it('chama onCancel ao clicar em cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AnamneseForm alunoId="aluno-1" onSuccess={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
