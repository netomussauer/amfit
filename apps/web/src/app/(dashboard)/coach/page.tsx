import { CoachVideosList } from '@/features/coach';

export const metadata = {
  title: 'Coach por Vídeo — AMFIT',
};

export default function CoachPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--color-text]">Coach por Vídeo</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Vídeos enviados pelos seus alunos pedindo revisão de execução.
        </p>
      </div>
      <CoachVideosList />
    </div>
  );
}
