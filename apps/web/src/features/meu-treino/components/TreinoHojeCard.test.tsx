import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeItem, makeTreino } from '@/features/execucao/test-utils/fixtures';
import { TreinoHojeCard } from './TreinoHojeCard';

vi.mock('@/features/exercicios/components/MidiaPreview', () => ({
  MidiaPreview: ({ url, alt }: { url: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- stub de teste
    <img src={url} alt={alt} data-testid="midia" />
  ),
}));

function item(id: string, overrides: Parameters<typeof makeItem>[0] = {}) {
  return makeItem({ id, ...overrides });
}

describe('TreinoHojeCard', () => {
  it('mostra letra, nome e a contagem de exercicios no plural', () => {
    const treino = makeTreino({
      letra: 'B',
      nome: 'Costas',
      itens: [item('1'), item('2')],
    });

    render(<TreinoHojeCard treino={treino} />);

    expect(screen.getByText('Treino B')).toBeInTheDocument();
    expect(screen.getByText('Costas')).toBeInTheDocument();
    expect(screen.getByText('2 exercícios')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Treino B, Costas, 2 exercícios'),
    ).toBeInTheDocument();
  });

  it('usa singular para um unico exercicio e omite o nome quando ausente', () => {
    render(<TreinoHojeCard treino={makeTreino({ letra: 'A', nome: null, itens: [item('1')] })} />);

    expect(screen.getByText('1 exercício')).toBeInTheDocument();
    expect(screen.getByLabelText('Treino A, 1 exercício')).toBeInTheDocument();
  });

  it('lista cada exercicio com nome, grupo muscular e series x repeticoes', () => {
    const treino = makeTreino({
      itens: [item('1', { series: 4, repeticoes: '8-12' })],
    });

    render(<TreinoHojeCard treino={treino} />);

    const lista = screen.getByRole('list', { name: 'Exercícios do treino A' });
    const linhas = within(lista).getAllByRole('listitem');
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText('Supino Reto')).toBeInTheDocument();
    expect(within(linhas[0]).getByText('Peito')).toBeInTheDocument();
    expect(within(linhas[0]).getByText('4×8-12')).toBeInTheDocument();
  });

  it.each([
    [40, '40 kg'],
    [22.5, '22,5 kg'],
    [22.55, '22,55 kg'],
    [12.0, '12 kg'],
    [0, '0 kg'],
  ])('formata a carga sugerida %s como "%s"', (carga, esperado) => {
    render(<TreinoHojeCard treino={makeTreino({ itens: [item('1', { carga_sugerida: carga })] })} />);

    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('nao mostra carga nem separador quando carga_sugerida e nula', () => {
    render(<TreinoHojeCard treino={makeTreino({ itens: [item('1', { carga_sugerida: null })] })} />);

    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('mostra a midia do exercicio quando existe e o icone padrao quando nao', () => {
    const comMidia = makeItem({
      id: '1',
      exercicio: {
        ...makeItem().exercicio,
        nome: 'Remada',
        midia_url: 'https://cdn.local/remada.png',
        tipo_midia: 'IMAGEM',
      },
    });
    const semMidia = item('2');

    render(<TreinoHojeCard treino={makeTreino({ itens: [comMidia, semMidia] })} />);

    const midias = screen.getAllByTestId('midia');
    expect(midias).toHaveLength(1);
    expect(midias[0]).toHaveAttribute('src', 'https://cdn.local/remada.png');
    expect(midias[0]).toHaveAttribute('alt', 'Remada');
  });
});
