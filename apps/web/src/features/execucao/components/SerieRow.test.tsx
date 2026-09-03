import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ItemTreinoResponse, RegistroSerieResponse } from '@amfit/shared';
import { SerieRow } from './SerieRow';

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

function makeRegistro(overrides: Partial<RegistroSerieResponse> = {}): RegistroSerieResponse {
  return {
    id: '40000000-0000-0000-0000-000000000001',
    item_treino_id: '30000000-0000-0000-0000-000000000001',
    numero_serie: 1,
    concluida: false,
    carga_realizada: null,
    repeticoes_realizadas: null,
    ...overrides,
  };
}

describe('SerieRow', () => {
  it('preenche a carga com a carga_sugerida do item quando nao ha registro nem sugestao de progressao', () => {
    const item = makeItem({ carga_sugerida: 40 });

    render(
      <SerieRow item={item} numeroSerie={1} registro={undefined} onConcluir={vi.fn()} />,
    );

    expect(screen.getByLabelText('Carga (kg)')).toHaveValue('40');
  });

  it('prioriza a carga sugerida por progressao sobre a carga_sugerida estatica do item', () => {
    const item = makeItem({ carga_sugerida: 40 });

    render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={22.5}
        onConcluir={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Carga (kg)')).toHaveValue('22,5');
  });

  it('prioriza a carga do registro ja salvo sobre a sugestao de progressao', () => {
    const item = makeItem();
    const registro = makeRegistro({ carga_realizada: 60 });

    render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={registro}
        cargaSugeridaProgressao={22.5}
        onConcluir={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Carga (kg)')).toHaveValue('60');
  });

  it('aplica a sugestao de progressao quando ela chega depois do primeiro render', async () => {
    const item = makeItem({ carga_sugerida: 40 });
    const { rerender } = render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={undefined}
        onConcluir={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Carga (kg)')).toHaveValue('40');

    rerender(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={22.5}
        onConcluir={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Carga (kg)')).toHaveValue('22,5'));
  });

  it('nao sobrescreve a carga que o usuario ja editou quando a sugestao chega depois', () => {
    const item = makeItem({ carga_sugerida: 40 });
    const { rerender } = render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={undefined}
        onConcluir={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Carga (kg)'), { target: { value: '35' } });

    rerender(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={22.5}
        onConcluir={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Carga (kg)')).toHaveValue('35');
  });

  it('chama onConcluir com os dados corretos ao marcar como concluida', () => {
    const item = makeItem();
    const onConcluir = vi.fn();
    render(
      <SerieRow item={item} numeroSerie={2} registro={undefined} onConcluir={onConcluir} />,
    );

    fireEvent.change(screen.getByLabelText('Carga (kg)'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /marcar série 2 como concluída/i }));

    expect(onConcluir).toHaveBeenCalledWith({
      numero_serie: 2,
      item_treino_id: item.id,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 10,
    });
  });

  it('desabilita os campos quando a serie ja esta concluida', () => {
    const item = makeItem();
    const registro = makeRegistro({ concluida: true });

    render(
      <SerieRow item={item} numeroSerie={1} registro={registro} onConcluir={vi.fn()} />,
    );

    expect(screen.getByLabelText('Carga (kg)')).toBeDisabled();
    expect(screen.getByLabelText('Reps')).toBeDisabled();
  });
});
