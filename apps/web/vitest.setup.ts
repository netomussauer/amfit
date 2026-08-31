import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// `test.globals` fica desligado (imports explicitos de vitest em cada
// arquivo de teste, mesmo padrao de import do resto do projeto) — por isso
// o auto-cleanup embutido do Testing Library (que depende de `afterEach`
// estar em `globalThis`) nao dispara sozinho. Registrando aqui explicitamente
// evitamos DOM vazando de um teste pro outro dentro do mesmo arquivo.
afterEach(() => {
  cleanup();
});

// jsdom nao implementa ResizeObserver, usado pelo recharts (via
// ResponsiveContainer) para medir o container do grafico. Sem este stub,
// qualquer componente que renderize um grafico recharts lanca
// `ReferenceError: ResizeObserver is not defined` em ambiente de teste.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
