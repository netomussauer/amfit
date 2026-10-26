import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemTreinoResponse } from '@amfit/shared';
import { useSessao } from '../hooks/useSessao';
import { useRegistrarSerie } from '../hooks/useRegistrarSerie';
import { useConcluirSessao } from '../hooks/useConcluirSessao';
import { makeItem, makeSerie, makeSessao, makeTreino } from '../test-utils/fixtures';
import { ExecucaoTreino } from './ExecucaoTreino';

vi.mock('../hooks/useSessao');
vi.mock('../hooks/useRegistrarSerie');
vi.mock('../hooks/useConcluirSessao');

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ExercicioBlock e RestTimer tem testes proprios; aqui so interessa como o
// ExecucaoTreino os orquestra.
vi.mock('./ExercicioBlock', () => ({
  ExercicioBlock: ({
    item,
    registros,
    onRegistrarSerie,
  }: {
    item: ItemTreinoResponse;
    registros: unknown[];
    onRegistrarSerie: (input: Record<string, unknown>) => void;
  }) => (
    <div data-testid={`bloco-${item.id}`} data-registros={registros.length}>
      <button
        type="button"
        onClick={() =>
          onRegistrarSerie({
            numero_serie: 1,
            item_treino_id: item.id,
            concluida: true,
            carga_realizada: 20,
            repeticoes_realizadas: 10,
            rpe: 7,
          })
        }
      >
        marcar-{item.id}
      </button>
      <button
        type="button"
        onClick={() =>
          onRegistrarSerie({
            numero_serie: 1,
            item_treino_id: item.id,
            concluida: false,
            carga_realizada: null,
            repeticoes_realizadas: null,
            rpe: null,
          })
        }
      >
        desmarcar-{item.id}
      </button>
    </div>
  ),
}));

vi.mock('./RestTimer', () => ({
  RestTimer: ({
    visible,
    duracaoSegundos,
    onSkip,
    onComplete,
  }: {
    visible: boolean;
    duracaoSegundos: number;
    onSkip: () => void;
    onComplete: () => void;
  }) => (
    <div data-testid="rest-timer" data-visible={String(visible)} data-duracao={duracaoSegundos}>
      <button type="button" onClick={onSkip}>
        pular
      </button>
      <button type="button" onClick={onComplete}>
        terminar
      </button>
    </div>
  ),
}));

const mockedUseSessao = vi.mocked(useSessao);
const mockedUseRegistrarSerie = vi.mocked(useRegistrarSerie);
const mockedUseConcluirSessao = vi.mocked(useConcluirSessao);

const registrarMutate = vi.fn();
const concluirMutate = vi.fn();
const refetch = vi.fn();

function mockSessaoQuery(overrides: Record<string, unknown>) {
  mockedUseSessao.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useSessao>);
}

function mockConcluir(overrides: Record<string, unknown> = {}) {
  mockedUseConcluirSessao.mockReturnValue({
    mutate: concluirMutate,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useConcluirSessao>);
}

// Treino A com 2 itens de 2 series cada (4 series no total).
const item1 = makeItem({ id: 'item-1', series: 2, descanso_segundos: 45 });
const item2 = makeItem({ id: 'item-2', series: 2, descanso_segundos: 0 });
const treino = makeTreino({ letra: 'A', nome: 'Peito', itens: [item1, item2] });

function sessaoComSeriesConcluidas(n: number) {
  return makeSessao({
    id: 'sessao-1',
    treino,
    series: Array.from({ length: n }, (_, i) =>
      makeSerie({ id: `s${i}`, item_treino_id: i < 2 ? 'item-1' : 'item-2', concluida: true }),
    ),
  });
}

describe('ExecucaoTreino', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRegistrarSerie.mockReturnValue({
      mutate: registrarMutate,
    } as unknown as ReturnType<typeof useRegistrarSerie>);
    mockConcluir();
  });

  describe('estados de carregamento', () => {
    it('mostra "Carregando treino..." enquanto busca a sessao', () => {
      mockSessaoQuery({ isLoading: true });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByText('Carregando treino...')).toBeInTheDocument();
    });

    it('mostra erro com retry quando a busca falha', () => {
      mockSessaoQuery({ isError: true });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar este treino.');
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/treino');
    });

    it('trata sessao sem dados como erro de carregamento', () => {
      mockSessaoQuery({ data: undefined });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByText('Não foi possível carregar este treino.')).toBeInTheDocument();
    });

    it('avisa quando a sessao veio sem o treino populado', () => {
      mockSessaoQuery({ data: makeSessao({ treino: undefined }) });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByText('O treino desta sessão não foi encontrado.')).toBeInTheDocument();
    });
  });

  describe('cabecalho e progresso', () => {
    it('mostra titulo do treino, contagem de series e atributos do progressbar', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(1) });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByRole('heading', { name: 'Treino A · Peito' })).toBeInTheDocument();
      expect(screen.getByText('1 de 4 séries')).toBeInTheDocument();
      const barra = screen.getByRole('progressbar');
      expect(barra).toHaveAttribute('aria-valuemax', '4');
      expect(barra).toHaveAttribute('aria-valuenow', '1');
    });

    it('omite o nome do treino quando nao ha', () => {
      mockSessaoQuery({
        data: makeSessao({ treino: makeTreino({ letra: 'C', nome: null, itens: [item1] }) }),
      });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByRole('heading', { name: 'Treino C' })).toBeInTheDocument();
    });

    it('passa para cada bloco apenas os registros do proprio item', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(3) });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByTestId('bloco-item-1')).toHaveAttribute('data-registros', '2');
      expect(screen.getByTestId('bloco-item-2')).toHaveAttribute('data-registros', '1');
    });

    it('so conta como feitas as series com concluida=true', () => {
      mockSessaoQuery({
        data: makeSessao({
          treino,
          series: [
            makeSerie({ id: 'a', item_treino_id: 'item-1', concluida: true }),
            makeSerie({ id: 'b', item_treino_id: 'item-1', concluida: false }),
          ],
        }),
      });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByText('1 de 4 séries')).toBeInTheDocument();
    });

    it('nao divide por zero quando o treino nao tem series', () => {
      mockSessaoQuery({ data: makeSessao({ treino: makeTreino({ itens: [] }) }) });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(screen.getByText('0 de 0 séries')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Concluir treino/ })).toBeDisabled();
    });
  });

  describe('registro de series e descanso', () => {
    beforeEach(() => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(0) });
    });

    it('envia o registro ao backend com o corpo mapeado', () => {
      render(<ExecucaoTreino sessaoId="sessao-1" />);

      fireEvent.click(screen.getByText('marcar-item-1'));

      expect(registrarMutate).toHaveBeenCalledWith({
        item_treino_id: 'item-1',
        numero_serie: 1,
        concluida: true,
        carga_realizada: 20,
        repeticoes_realizadas: 10,
        rpe: 7,
      });
    });

    it('usa o id da sessao ao montar os hooks de mutacao', () => {
      render(<ExecucaoTreino sessaoId="sessao-1" />);

      expect(mockedUseRegistrarSerie).toHaveBeenCalledWith('sessao-1');
      expect(mockedUseConcluirSessao).toHaveBeenCalledWith('sessao-1');
    });

    it('inicia o descanso do item ao concluir uma serie', () => {
      render(<ExecucaoTreino sessaoId="sessao-1" />);
      expect(screen.getByTestId('rest-timer')).toHaveAttribute('data-visible', 'false');

      fireEvent.click(screen.getByText('marcar-item-1'));

      const timer = screen.getByTestId('rest-timer');
      expect(timer).toHaveAttribute('data-visible', 'true');
      expect(timer).toHaveAttribute('data-duracao', '45');
    });

    it('nao inicia descanso quando o item tem descanso 0', () => {
      render(<ExecucaoTreino sessaoId="sessao-1" />);

      fireEvent.click(screen.getByText('marcar-item-2'));

      expect(registrarMutate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('rest-timer')).toHaveAttribute('data-visible', 'false');
    });

    it('nao inicia descanso ao desmarcar uma serie', () => {
      render(<ExecucaoTreino sessaoId="sessao-1" />);

      fireEvent.click(screen.getByText('desmarcar-item-1'));

      expect(registrarMutate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('rest-timer')).toHaveAttribute('data-visible', 'false');
    });

    it.each(['pular', 'terminar'])('fecha o descanso ao acionar "%s"', (botao) => {
      render(<ExecucaoTreino sessaoId="sessao-1" />);
      fireEvent.click(screen.getByText('marcar-item-1'));
      expect(screen.getByTestId('rest-timer')).toHaveAttribute('data-visible', 'true');

      fireEvent.click(screen.getByText(botao));

      expect(screen.getByTestId('rest-timer')).toHaveAttribute('data-visible', 'false');
    });
  });

  describe('concluir treino', () => {
    it('fica desabilitado abaixo de 50% e informa o minimo de series', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(1) });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      const botao = screen.getByRole('button', { name: /Concluir treino/ });
      expect(botao).toBeDisabled();
      expect(botao).toHaveTextContent('Marque ao menos 2 séries');
    });

    it('habilita exatamente em 50% e esconde o aviso', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(2) });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      const botao = screen.getByRole('button', { name: 'Concluir treino' });
      expect(botao).toBeEnabled();
      expect(screen.queryByText(/Marque ao menos/)).not.toBeInTheDocument();
    });

    it('nao conclui se o usuario cancelar a confirmacao', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(4) });
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<ExecucaoTreino sessaoId="sessao-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Concluir treino' }));

      expect(window.confirm).toHaveBeenCalledWith(
        'Tem certeza? Séries não marcadas serão consideradas puladas.',
      );
      expect(concluirMutate).not.toHaveBeenCalled();
    });

    it('conclui e navega para a tela de resumo em caso de sucesso', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(4) });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      concluirMutate.mockImplementation((_v, opts) => opts.onSuccess());

      render(<ExecucaoTreino sessaoId="sessao-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Concluir treino' }));

      expect(concluirMutate).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/treino/concluido/sessao-1');
    });

    it('mostra o detail devolvido pela API quando a conclusao falha', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(4) });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      concluirMutate.mockImplementation((_v, opts) =>
        opts.onError({ response: { data: { detail: 'Sessão já concluída.' } } }),
      );

      render(<ExecucaoTreino sessaoId="sessao-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Concluir treino' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Sessão já concluída.');
      expect(push).not.toHaveBeenCalled();
    });

    it('usa mensagem generica quando a API nao traz detail', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(4) });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      concluirMutate.mockImplementation((_v, opts) => opts.onError({}));

      render(<ExecucaoTreino sessaoId="sessao-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Concluir treino' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível concluir o treino. Tente novamente.',
      );
    });

    it('limpa o erro anterior ao tentar concluir de novo', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(4) });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      concluirMutate.mockImplementationOnce((_v, opts) => opts.onError({}));

      render(<ExecucaoTreino sessaoId="sessao-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Concluir treino' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      concluirMutate.mockImplementationOnce(() => undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Concluir treino' }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('mostra "Concluindo..." e desabilita enquanto a mutacao esta pendente', () => {
      mockSessaoQuery({ data: sessaoComSeriesConcluidas(4) });
      mockConcluir({ isPending: true });

      render(<ExecucaoTreino sessaoId="sessao-1" />);

      const botao = screen.getByRole('button', { name: 'Concluindo...' });
      expect(botao).toBeDisabled();
      expect(botao).toHaveAttribute('aria-busy', 'true');
    });
  });
});
