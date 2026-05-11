import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone gera servidor minimo em .next/standalone para o Dockerfile.
  // Em monorepos pnpm, outputFileTracingRoot precisa apontar para a raiz do
  // workspace para que o Next inclua packages/shared + node_modules necessarios.
  // Sem isso, .next/standalone fica sem server.js no path esperado pelo CMD.
  //
  // No Next.js 14, outputFileTracingRoot vive dentro de `experimental` (moveu
  // para top-level no 15+).
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  // Necessario quando @amfit/shared e workspace TS (sem build separado)
  transpilePackages: ['@amfit/shared'],
};

export default nextConfig;
