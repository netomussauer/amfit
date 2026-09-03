import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AnamneseResponse } from '@amfit/shared';
import { AnamneseResultado } from './AnamneseResultado';

const anamneseFixture: AnamneseResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  aluno_id: '22222222-2222-2222-2222-222222222222',
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

describe('AnamneseResultado', () => {
  it('exibe objetivo, score, nivel e as 5 respostas', () => {
    render(<AnamneseResultado anamnese={anamneseFixture} onReavaliar={vi.fn()} />);

    expect(screen.getByText('Ganhar massa magra')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Intermediário')).toBeInTheDocument();
    expect(screen.getByText('3-4 dias/semana')).toBeInTheDocument();
    expect(screen.getByText('6 meses a 2 anos')).toBeInTheDocument();
    expect(screen.getByText('Hipertrofia')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
    expect(screen.getByText('3 dias')).toBeInTheDocument();
  });

  it('chama onReavaliar ao clicar no botao', async () => {
    const user = userEvent.setup();
    const onReavaliar = vi.fn();
    render(<AnamneseResultado anamnese={anamneseFixture} onReavaliar={onReavaliar} />);

    await user.click(screen.getByRole('button', { name: /reavaliar anamnese/i }));

    expect(onReavaliar).toHaveBeenCalledTimes(1);
  });
});
