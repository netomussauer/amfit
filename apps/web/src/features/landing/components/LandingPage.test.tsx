import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('mostra o headline principal e os CTAs', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1, name: /carrega a sua marca/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /comece agora/i }).length).toBeGreaterThan(0);
  });

  it('mostra um botão de login visível no menu, para quem já tem conta', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: /^entrar$/i })).toHaveAttribute('href', '/login');
  });

  it('mostra os 4 pilares de funcionalidades', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: 'Prescrever' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Executar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sua marca' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gerenciar' })).toBeInTheDocument();
  });

  it('mostra a seção de white label com o exemplo de código de convite', () => {
    render(<LandingPage />);

    expect(screen.getByText(/sua consultoria — não a nossa/i)).toBeInTheDocument();
    expect(screen.getByText('K7XT4RPQ')).toBeInTheDocument();
    expect(screen.getByText(/ilustrativo/i)).toBeInTheDocument();
  });

  it('mostra as perguntas frequentes', () => {
    render(<LandingPage />);

    expect(screen.getByText('Preciso de internet o tempo todo?')).toBeInTheDocument();
    expect(screen.getByText('Consigo usar a minha própria marca?')).toBeInTheDocument();
    expect(screen.getByText('Como funciona a cobrança dos meus alunos?')).toBeInTheDocument();
  });

  it('mostra o rodapé com o link para quem já tem conta', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: /já tenho conta/i })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/feito para personal trainers no brasil/i)).toBeInTheDocument();
  });
});
