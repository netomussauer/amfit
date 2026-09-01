import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { GrupoMuscular } from '@amfit/shared';
import { useCriarExercicio } from '../hooks/useCriarExercicio';
import { useAtualizarExercicio } from '../hooks/useAtualizarExercicio';
import { useGruposMusculares } from '../hooks/useGruposMusculares';
import { ExercicioForm } from './ExercicioForm';

vi.mock('../hooks/useCriarExercicio');
vi.mock('../hooks/useAtualizarExercicio');
vi.mock('../hooks/useGruposMusculares');

const { mockedReplace, mockedRefresh, mockedBack, mockedUseRouter } = vi.hoisted(() => ({
  mockedReplace: vi.fn(),
  mockedRefresh: vi.fn(),
  mockedBack: vi.fn(),
  mockedUseRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: mockedUseRouter,
}));

// jsdom nao implementa URL.createObjectURL/revokeObjectURL (usados pelo
// preview de midia no MidiaUpload interno do form).
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-preview');
  URL.revokeObjectURL = vi.fn();
});

const mockedUseCriarExercicio = vi.mocked(useCriarExercicio);
const mockedUseAtualizarExercicio = vi.mocked(useAtualizarExercicio);
const mockedUseGruposMusculares = vi.mocked(useGruposMusculares);

const gruposFixture: GrupoMuscular[] = [
  { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  { id: '22222222-2222-2222-2222-222222222222', nome: 'Costas' },
];

function mockCriar(overrides: Partial<ReturnType<typeof useCriarExercicio>>) {
  mockedUseCriarExercicio.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarExercicio>);
}

function mockAtualizar(overrides: Partial<ReturnType<typeof useAtualizarExercicio>>) {
  mockedUseAtualizarExercicio.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarExercicio>);
}

function mockGrupos(overrides: Partial<ReturnType<typeof useGruposMusculares>> = {}) {
  mockedUseGruposMusculares.mockReturnValue({
    data: gruposFixture,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useGruposMusculares>);
}

function makeAxiosError(status: number, data: unknown) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('ExercicioForm — mode create', () => {
  beforeEach(() => {
    mockedUseCriarExercicio.mockReset();
    mockedUseAtualizarExercicio.mockReset();
    mockedUseGruposMusculares.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedBack.mockReset();
    mockedUseRouter.mockReturnValue({
      replace: mockedReplace,
      refresh: mockedRefresh,
      back: mockedBack,
    });
    mockCriar({});
    mockGrupos();
  });

  it('exibe erros de validacao quando nome e grupo muscular estao vazios', async () => {
    const user = userEvent.setup();
    render(<ExercicioForm mode="create" />);

    await user.click(screen.getByRole('button', { name: /cadastrar exercício/i }));

    expect(
      await screen.findByText('Nome deve ter ao menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('ID do grupo muscular inválido')).toBeInTheDocument();
  });

  it('envia a mutation com os dados do formulario e midia nula quando nenhum arquivo e selecionado', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockCriar({ mutate });

    render(<ExercicioForm mode="create" />);

    await user.type(screen.getByLabelText(/nome do exercício/i), 'Supino reto');
    await user.selectOptions(screen.getByLabelText(/grupo muscular/i), 'Peito');
    await user.click(screen.getByRole('button', { name: /cadastrar exercício/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      {
        data: {
          nome: 'Supino reto',
          grupo_muscular_id: gruposFixture[0]!.id,
          descricao: '',
        },
        midia: null,
      },
      expect.anything(),
    );
  });

  it('redireciona para /exercicios quando o cadastro tem sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess(undefined);
    });
    mockCriar({ mutate });

    render(<ExercicioForm mode="create" />);

    await user.type(screen.getByLabelText(/nome do exercício/i), 'Supino reto');
    await user.selectOptions(screen.getByLabelText(/grupo muscular/i), 'Peito');
    await user.click(screen.getByRole('button', { name: /cadastrar exercício/i }));

    expect(mockedReplace).toHaveBeenCalledWith('/exercicios');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de tamanho excedido quando a API retorna 413', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(makeAxiosError(413, { detail: 'payload too large' }));
    });
    mockCriar({ mutate });

    render(<ExercicioForm mode="create" />);

    await user.type(screen.getByLabelText(/nome do exercício/i), 'Supino reto');
    await user.selectOptions(screen.getByLabelText(/grupo muscular/i), 'Peito');
    await user.click(screen.getByRole('button', { name: /cadastrar exercício/i }));

    expect(
      screen.getByText('Arquivo de mídia excede o tamanho máximo permitido.'),
    ).toBeInTheDocument();
  });

  it('exibe mensagem generica quando a API retorna erro inesperado', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(makeAxiosError(500, { detail: 'erro interno' }));
    });
    mockCriar({ mutate });

    render(<ExercicioForm mode="create" />);

    await user.type(screen.getByLabelText(/nome do exercício/i), 'Supino reto');
    await user.selectOptions(screen.getByLabelText(/grupo muscular/i), 'Peito');
    await user.click(screen.getByRole('button', { name: /cadastrar exercício/i }));

    expect(
      screen.getByText('Não foi possível cadastrar o exercício. Tente novamente.'),
    ).toBeInTheDocument();
  });

  // ── BUG CONHECIDO ────────────────────────────────────────────────────
  //
  // O backend responde 422 com `errors` no formato RFC 7807 usado em todo o
  // resto do app (array de `{ field, message }` — ver
  // apps/api/pkg/middleware/problem.go `ProblemDetail.Errors
  // []ProblemFieldError` e o tratamento correto em
  // features/configuracoes/components/ContaForm.tsx, que itera
  // `data.errors` como array).
  //
  // ExercicioForm.tsx, porem, trata `data.errors` como um
  // `Record<string, string>` e usa `Object.entries(data.errors)` — em um
  // array isso itera pares de indice/objeto (`["0", {field,message}]`), e a
  // checagem `field === 'nome' | 'descricao' | 'grupo_muscular_id'` nunca
  // bate (o "field" observado e sempre o indice numerico da posicao no
  // array). Resultado: `setError` nunca e chamado para o campo real, e o
  // erro de validacao por campo (ex.: "grupo muscular inválido") nunca
  // aparece inline — so o banner generico de erro e exibido.
  //
  // Este teste documenta o comportamento ATUAL (buggy) contra o formato
  // real do backend. Não foi corrigido silenciosamente pois estava fora do
  // escopo desta tarefa de testes — reportado no resumo final para decisão
  // do time.
  it('[BUG CONHECIDO] nao atribui o erro de campo quando a API retorna errors[] (formato real do backend)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(
        makeAxiosError(422, {
          detail: 'validation failed',
          errors: [{ field: 'grupo_muscular_id', message: 'ID do grupo muscular inválido' }],
        }),
      );
    });
    mockCriar({ mutate });

    render(<ExercicioForm mode="create" />);

    await user.type(screen.getByLabelText(/nome do exercício/i), 'Supino reto');
    await user.selectOptions(screen.getByLabelText(/grupo muscular/i), 'Peito');
    await user.click(screen.getByRole('button', { name: /cadastrar exercício/i }));

    // O banner generico aparece normalmente...
    expect(
      screen.getByText('Há campos inválidos no formulário. Revise e tente novamente.'),
    ).toBeInTheDocument();

    // ...mas o erro inline no campo especifico NAO e atribuido, por causa do
    // bug de shape descrito acima. Se este `expect` comecar a falhar (ou
    // seja, o texto passar a aparecer), o bug foi corrigido e este teste
    // deve ser atualizado para refletir o comportamento correto.
    const grupoSelect = screen.getByLabelText(/grupo muscular/i);
    expect(grupoSelect).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('ID do grupo muscular inválido')).not.toBeInTheDocument();
  });

  it('exibe erro de midia quando o arquivo selecionado tem formato nao suportado', async () => {
    // `applyAccept: false` — por padrao o user-event filtra a selecao pelo
    // atributo `accept` do input (emulando o dialogo nativo do SO), o que
    // impediria o onChange de disparar para um arquivo fora da lista aceita.
    // Aqui queremos justamente exercitar a validacao defensiva do proprio
    // componente (`validateMidia`), que tambem cobre o caso de o usuario
    // escolher "todos os arquivos" no dialogo nativo.
    const user = userEvent.setup({ applyAccept: false });
    mockCriar({});

    render(<ExercicioForm mode="create" />);

    const arquivo = new File(['conteudo'], 'documento.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/mídia \(imagem ou vídeo\)/i), arquivo);

    expect(
      screen.getByText(
        'Formato não suportado. Envie imagem (JPG, PNG, GIF, WebP) ou vídeo MP4.',
      ),
    ).toBeInTheDocument();
  });

  it('exibe preview e permite remover a midia quando um arquivo valido e selecionado', async () => {
    const user = userEvent.setup();
    mockCriar({});

    render(<ExercicioForm mode="create" />);

    const arquivo = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/mídia \(imagem ou vídeo\)/i), arquivo);

    expect(screen.getByText('foto.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remover/i }));
    expect(screen.queryByText('foto.jpg')).not.toBeInTheDocument();
  });

  it('desabilita o select de grupo muscular e exibe hint enquanto os grupos carregam', () => {
    mockGrupos({ data: undefined, isLoading: true });
    mockCriar({});

    render(<ExercicioForm mode="create" />);

    expect(screen.getByLabelText(/grupo muscular/i)).toBeDisabled();
    expect(screen.getByText('Carregando grupos musculares...')).toBeInTheDocument();
  });
});

describe('ExercicioForm — mode edit', () => {
  const exercicioId = '99999999-9999-9999-9999-999999999999';

  beforeEach(() => {
    mockedUseCriarExercicio.mockReset();
    mockedUseAtualizarExercicio.mockReset();
    mockedUseGruposMusculares.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedUseRouter.mockReturnValue({
      replace: mockedReplace,
      refresh: mockedRefresh,
      back: mockedBack,
    });
    mockAtualizar({});
    mockGrupos();
  });

  it('preenche o formulario com os defaultValues informados', () => {
    render(
      <ExercicioForm
        mode="edit"
        exercicioId={exercicioId}
        defaultValues={{
          nome: 'Supino reto',
          grupo_muscular_id: gruposFixture[0]!.id,
          descricao: 'Instruções',
        }}
      />,
    );

    expect(screen.getByLabelText(/nome do exercício/i)).toHaveValue('Supino reto');
    expect(screen.getByLabelText(/grupo muscular/i)).toHaveValue(gruposFixture[0]!.id);
    expect(screen.getByLabelText(/descrição/i)).toHaveValue('Instruções');
  });

  it('exibe aviso e desabilita campos quando readOnly e true (exercicio global)', () => {
    render(
      <ExercicioForm
        mode="edit"
        exercicioId={exercicioId}
        readOnly
        defaultValues={{ nome: 'Supino reto', grupo_muscular_id: gruposFixture[0]!.id }}
      />,
    );

    expect(
      screen.getByText('Este exercício é global e não pode ser editado.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nome do exercício/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });

  it('salva as alteracoes e exibe mensagem de sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess(undefined);
    });
    mockAtualizar({ mutate });

    render(
      <ExercicioForm
        mode="edit"
        exercicioId={exercicioId}
        defaultValues={{ nome: 'Supino reto', grupo_muscular_id: gruposFixture[0]!.id }}
      />,
    );

    await user.clear(screen.getByLabelText(/nome do exercício/i));
    await user.type(screen.getByLabelText(/nome do exercício/i), 'Supino inclinado');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      {
        id: exercicioId,
        payload: {
          nome: 'Supino inclinado',
          grupo_muscular_id: gruposFixture[0]!.id,
          descricao: '',
        },
      },
      expect.anything(),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Alterações salvas com sucesso.');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro quando a API retorna 403 (exercicio global)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(makeAxiosError(403, { detail: 'exercícios globais não podem ser editados' }));
    });
    mockAtualizar({ mutate });

    render(
      <ExercicioForm
        mode="edit"
        exercicioId={exercicioId}
        defaultValues={{ nome: 'Supino reto', grupo_muscular_id: gruposFixture[0]!.id }}
      />,
    );

    await user.clear(screen.getByLabelText(/nome do exercício/i));
    await user.type(screen.getByLabelText(/nome do exercício/i), 'Novo nome');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(
      screen.getByText('Exercícios globais não podem ser editados.'),
    ).toBeInTheDocument();
  });

  it('mantem o botao de salvar desabilitado enquanto o formulario nao foi alterado', () => {
    render(
      <ExercicioForm
        mode="edit"
        exercicioId={exercicioId}
        defaultValues={{ nome: 'Supino reto', grupo_muscular_id: gruposFixture[0]!.id }}
      />,
    );

    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });
});
