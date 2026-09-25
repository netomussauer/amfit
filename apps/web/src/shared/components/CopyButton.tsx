'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Texto que vai para a área de transferência. */
  text: string;
  /** Rótulo acessível e visível do botão (ex.: "Copiar link"). */
  label: string;
};

type Estado = 'idle' | 'copiado' | 'erro';

const RESET_MS = 2000;

export function CopyButton({ text, label }: Props) {
  const [estado, setEstado] = useState<Estado>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(text);
      setEstado('copiado');
    } catch {
      // Sem clipboard (HTTP fora de localhost, permissão negada): o texto
      // continua visível na tela para o usuário copiar à mão.
      setEstado('erro');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado('idle'), RESET_MS);
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      className="rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
    >
      {estado === 'copiado' ? 'Copiado!' : estado === 'erro' ? 'Copie manualmente' : label}
    </button>
  );
}
