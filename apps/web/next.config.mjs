import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API_ORIGIN aponta para a origem do backend (esquema + host + porta).
// Lemos sem prefixo /api/v1 — esse e adicionado nas rotas dos rewrites.
//
// Em K8s: setamos API_ORIGIN=http://amfit-api.amfit.svc.cluster.local:8080
// (DNS interno, sem TLS). Em dev local: localhost:8080.
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8080';

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

  // Proxy server-side de /api/v1/* para o backend. Mantem todas as chamadas
  // do browser na mesma origem do web (sem CORS, sem precisar expor o backend
  // ao cliente). O api-client usa baseURL relativa.
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
