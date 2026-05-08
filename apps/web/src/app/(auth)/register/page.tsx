import { RegisterPersonalForm } from '@/features/auth/components/RegisterPersonalForm';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[--color-bg-subtle] px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-[--color-border] bg-[--color-bg] p-8 shadow-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[--color-text]">Criar conta</h1>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Cadastre-se como personal trainer e comece a gerenciar seus alunos.
          </p>
        </div>
        <RegisterPersonalForm />
      </div>
    </main>
  );
}
