import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateListResponse } from '@amfit/shared';
import { useTemplates } from '../hooks/useTemplates';
import { TemplatesList } from './TemplatesList';

vi.mock('../hooks/useTemplates');

vi.mock('./AplicarTemplateModal', () => ({
  AplicarTemplateModal: ({ template, onClose }: { template: { nome: string }; onClose: () => void }) => (
    <div role="dialog" aria-label={`Aplicar ${template.nome}`}>
      <button type="button" onClick={onClose}>
        Fechar mock
      </button>
    </div>
  ),
}));

const mockedUseTemplates = vi.mocked(useTemplates);

function mockReturn(overrides: Partial<ReturnType<typeof useTemplates>>) {
  mockedUseTemplates.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTemplates>);
}

function makeItem(id: string) {
  return {
    id,
    exercicio: { id: 'exercicio-1' },
    treino_letra: 'A',
    ordem: 0,
    series: 3,
    repeticoes: '10-12',
  };
}

const templateListFixture: TemplateListResponse = {
  data: [
    {
      id: 'template-1',
      nome: 'Full Body Iniciante',
      nivel: 'INICIANTE',
      objetivo: 'hipertrofia',
      criado_por: 'SISTEMA',
      itens: [makeItem('item-1'), makeItem('item-2')],
    },
    {
      id: 'template-2',
      nome: 'Meu Full Body',
      nivel: 'INTERMEDIARIO',
      objetivo: 'forca',
      criado_por: 'PERSONAL',
      itens: [makeItem('item-1')],
    },
  ],
};

describe('TemplatesList', () => {
  beforeEach(() => {
    mockedUseTemplates.mockReset();
  });

  it('exibe o skeleton de carregamento', () => {
    mockReturn({ isLoading: true });

    const { container } = render(<TemplatesList />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockReturn({ isError: true, refetch });

    render(<TemplatesList />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os modelos de ficha.',
    );
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('mostra mensagem quando não há nenhum modelo', () => {
    mockReturn({ data: { data: [] } });

    render(<TemplatesList />);

    expect(screen.getByText(/nenhum modelo disponível/i)).toBeInTheDocument();
  });

  it('lista os modelos com nível, objetivo, contagem de exercícios e o rótulo de origem', () => {
    mockReturn({ data: templateListFixture });

    render(<TemplatesList />);

    expect(screen.getByText('Full Body Iniciante')).toBeInTheDocument();
    expect(screen.getByText(/iniciante.*hipertrofia.*2 exercícios/i)).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();

    expect(screen.getByText('Meu Full Body')).toBeInTheDocument();
    expect(screen.getByText(/intermediário.*força.*1 exercício\b/i)).toBeInTheDocument();
    expect(screen.getByText('Meu modelo')).toBeInTheDocument();
  });

  it('abre o modal de aplicar ao clicar em "Aplicar a um aluno"', async () => {
    const user = userEvent.setup();
    mockReturn({ data: templateListFixture });

    render(<TemplatesList />);

    await user.click(screen.getAllByRole('button', { name: /aplicar a um aluno/i })[0]);

    expect(screen.getByRole('dialog', { name: 'Aplicar Full Body Iniciante' })).toBeInTheDocument();
  });
});
