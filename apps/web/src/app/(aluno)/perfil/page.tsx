import { PerfilInfo } from '@/features/meu-perfil/components/PerfilInfo';

export const metadata = {
  title: 'Perfil — AMFIT',
};

export default function PerfilPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex flex-col gap-1 border-b border-[--color-border] pb-4">
        <h1 className="text-2xl font-bold text-[--color-text]">Perfil</h1>
        <p className="text-sm text-[--color-text-muted]">
          Suas informações cadastrais.
        </p>
      </header>

      <PerfilInfo />
    </div>
  );
}
