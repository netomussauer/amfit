'use client';

import { useState } from 'react';

/**
 * Captação de contato da landing page. Sem endpoint no backend ainda —
 * a submissão só confirma na tela; quando houver uma ferramenta de
 * marketing/CRM definida, troca-se por uma chamada real aqui dentro,
 * sem mudar o resto da página.
 */
export function LeadForm() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  // Guardado à parte de `nome` porque o campo é limpo logo após o envio —
  // a mensagem de confirmação precisa continuar mostrando o nome digitado.
  // Uma string vazia é um valor válido aqui (nome só com espaços) — o que
  // decide se a mensagem aparece é `enviado`, nunca este valor sozinho.
  const [primeiroNomeEnviado, setPrimeiroNomeEnviado] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPrimeiroNomeEnviado(nome.trim().split(' ')[0] ?? '');
    setEnviado(true);
    setNome('');
    setEmail('');
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap justify-center gap-2.5"
      >
        <label htmlFor="lead-nome" className="sr-only">
          Seu nome
        </label>
        <input
          id="lead-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          required
          autoComplete="name"
          className="min-w-[220px] rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-3 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        />
        <label htmlFor="lead-email" className="sr-only">
          Seu e-mail
        </label>
        <input
          id="lead-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          required
          autoComplete="email"
          className="min-w-[220px] rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-3 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        />
        <button
          type="submit"
          className="rounded-md bg-[--color-primary] px-5 py-3 text-sm font-bold text-white hover:bg-[--color-primary-hover]"
        >
          Quero ser avisado
        </button>
      </form>
      <p role="status" aria-live="polite" className="mt-4 min-h-[1.2em] text-sm font-semibold text-[--color-success]">
        {enviado &&
          `Obrigado${primeiroNomeEnviado ? `, ${primeiroNomeEnviado}` : ''}! Recebemos seu contato e avisaremos assim que o acesso abrir.`}
      </p>
    </div>
  );
}
