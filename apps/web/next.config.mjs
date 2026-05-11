/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone gera servidor minimo em .next/standalone para o Dockerfile
  output: 'standalone',
  // Necessario quando @amfit/shared e workspace TS (sem build separado)
  transpilePackages: ['@amfit/shared'],
};

export default nextConfig;
