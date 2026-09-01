'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { LoginRequestSchema, type LoginRequest, ROLES } from '@amfit/shared';
import { useLogin } from '../hooks/useLogin';

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: {
      email: '',
      senha: '',
      tipo: ROLES.PERSONAL,
    },
  });

  function handleLogin(values: LoginRequest) {
    setServerError(null);
    mutate(values, {
      onSuccess: (data) => {
        router.replace(data.usuario.role === ROLES.ALUNO ? '/treino' : '/dashboard');
        router.refresh();
      },
      onError: (err) => {
        if (err.response?.status === 401) {
          setServerError('E-mail ou senha inválidos. Verifique e tente novamente.');
        } else {
          setServerError('Não foi possível entrar agora. Tente novamente em instantes.');
        }
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(handleLogin)} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          E-mail *
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          placeholder="seu@email.com"
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="senha"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          Senha *
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          aria-required="true"
          aria-invalid={!!errors.senha}
          aria-describedby={errors.senha ? 'senha-error' : undefined}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          placeholder="••••••••"
          {...register('senha')}
        />
        {errors.senha && (
          <p id="senha-error" role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.senha.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="tipo"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          Tipo de conta *
        </label>
        <select
          id="tipo"
          aria-required="true"
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          {...register('tipo')}
        >
          <option value={ROLES.PERSONAL}>Personal Trainer</option>
          <option value={ROLES.ALUNO}>Aluno</option>
        </select>
      </div>

      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
        >
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Entrando...' : 'Entrar'}
      </button>

      <p className="text-center text-sm text-[--color-text-muted]">
        Ainda não tem conta?{' '}
        <a
          href="/register"
          className="font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
        >
          Cadastre-se como personal
        </a>
      </p>
    </form>
  );
}
