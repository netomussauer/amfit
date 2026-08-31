import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Espelha os path aliases de tsconfig.json (`@/*` -> `src/*`). O Vitest
// nao le tsconfig "paths" automaticamente — precisa da propria config de
// resolve.alias. `@amfit/shared` e resolvido direto para o source (mesma
// estrategia do next.config.mjs via transpilePackages), evitando depender
// de node_modules estar linkado corretamente para os testes rodarem.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/app/**', // paginas/rotas do App Router — cobertas por E2E, nao unit
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@amfit/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
