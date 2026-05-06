import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/shared/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'AMFIT — Plataforma de Gestão de Treinos',
  description: 'Gerencie alunos, fichas e treinos com facilidade.',
};

type Props = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html lang="pt-BR">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
