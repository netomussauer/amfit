'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  RegisterPersonalRequestSchema,
  type RegisterPersonalRequest,
} from '@amfit/shared';
import { useRegisterPersonal } from '../hooks/useRegisterPersonal';

export function RegisterPersonalForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useRegisterPersonal();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterPersonalRequest>({
    resolver: zodResolver(RegisterPersonalRequestSchema),
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      telefone: '',
      cref: '',
    },
  });

  function handleRegister(values: RegisterPersonalRequest) {
    setServerError(null);
    mutate(values, {
      onSuccess: () => {
        router.replace('/dashboard');
        router.refresh();
      },
      onError: (err) => {
        if (err.response?.status === 409) {
          setError('email', { message: 'Este e-mail já está cadastrado' });
          return;
        }
        if (err.response?.status === 422) {
          setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
          return;
        }
        setServerError('Não foi possível concluir o cadastro. Tente novamente.');
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(handleRegister)} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="nome"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          Nome completo *
        </label>
        <input
          id="nome"
          type="text"
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!errors.nome}
          aria-describedby={errors.nome ? 'nome-error' : undefined}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          placeholder="João Silva"
          {...register('nome')}
        />
        {errors.nome && (
          <p id="nome-error" role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.nome.message}
          </p>
        )}
      </div>

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
          autoComplete="new-password"
          aria-required="true"
          aria-invalid={!!errors.senha}
          aria-describedby={errors.senha ? 'senha-error' : 'senha-hint'}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          placeholder="••••••••"
          {...register('senha')}
        />
        {errors.senha ? (
          <p id="senha-error" role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.senha.message}
          </p>
        ) : (
          <p id="senha-hint" className="mt-1 text-xs text-[--color-text-muted]">
            Mínimo de 8 caracteres.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="telefone"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          Telefone
        </label>
        <input
          id="telefone"
          type="tel"
          autoComplete="tel"
          aria-invalid={!!errors.telefone}
          aria-describedby={errors.telefone ? 'telefone-error' : undefined}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          placeholder="(11) 99999-9999"
          {...register('telefone')}
        />
        {errors.telefone && (
          <p id="telefone-error" role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.telefone.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="cref"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          CREF
        </label>
        <input
          id="cref"
          type="text"
          aria-invalid={!!errors.cref}
          aria-describedby={errors.cref ? 'cref-error' : undefined}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          placeholder="000000-G/SP"
          {...register('cref')}
        />
        {errors.cref && (
          <p id="cref-error" role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.cref.message}
          </p>
        )}
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
        {isPending ? 'Cadastrando...' : 'Criar conta'}
      </button>

      <p className="text-center text-sm text-[--color-text-muted]">
        Já tem conta?{' '}
        <a
          href="/login"
          className="font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
        >
          Entrar
        </a>
      </p>
    </form>
  );
}
