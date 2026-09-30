import { TemplatesList } from '@/features/fichas';

export const metadata = {
  title: 'Modelos de ficha — AMFIT',
};

export default function ModelosPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Modelos de ficha</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Aplique um modelo pronto a um aluno, ou salve uma ficha existente como modelo em
          &quot;Salvar como modelo&quot; dentro dela.
        </p>
      </header>

      <TemplatesList />
    </div>
  );
}
