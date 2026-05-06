import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[--color-bg-subtle]">
      <div className="w-full max-w-md rounded-lg border border-[--color-border] bg-[--color-bg] p-8 shadow-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[--color-text]">AMFIT</h1>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Acesse sua conta para continuar
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
