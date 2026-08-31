import { defineConfig } from 'vitest/config';

// packages/shared e logica pura (schemas Zod + helpers) consumida por web e
// mobile como source TS direto (sem build). Nao ha JSX/DOM aqui, entao o
// ambiente padrao 'node' e o plugin React do app web nao sao necessarios —
// config minima e isolada deste pacote.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
