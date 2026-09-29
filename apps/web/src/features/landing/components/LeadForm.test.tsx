import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LeadForm } from './LeadForm';

describe('LeadForm', () => {
  it('mostra a confirmação com o primeiro nome depois de enviar', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);

    await user.type(screen.getByPlaceholderText('Seu nome'), 'Ana Beatriz Souza');
    await user.type(screen.getByPlaceholderText('Seu e-mail'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: /quero ser avisado/i }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Obrigado, Ana! Recebemos seu contato e avisaremos assim que o acesso abrir.',
    );
  });

  it('mostra a confirmação genérica quando o nome é só espaços', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);

    await user.type(screen.getByPlaceholderText('Seu nome'), '   ');
    await user.type(screen.getByPlaceholderText('Seu e-mail'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: /quero ser avisado/i }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Obrigado! Recebemos seu contato e avisaremos assim que o acesso abrir.',
    );
  });

  it('não mostra confirmação antes do envio', () => {
    render(<LeadForm />);

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('limpa os campos depois de enviar', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);

    const nomeInput = screen.getByPlaceholderText('Seu nome');
    await user.type(nomeInput, 'Ana');
    await user.type(screen.getByPlaceholderText('Seu e-mail'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: /quero ser avisado/i }));

    expect(nomeInput).toHaveValue('');
  });
});
