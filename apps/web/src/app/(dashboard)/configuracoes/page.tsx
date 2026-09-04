import { ContaForm } from '@/features/configuracoes/components/ContaForm';
import { AlterarSenhaForm } from '@/features/configuracoes/components/AlterarSenhaForm';
import { BrandingForm } from '@/features/configuracoes/components/BrandingForm';

export const metadata = {
  title: 'Configurações — AMFIT',
};

export default function ConfiguracoesPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Configurações</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Gerencie os dados da sua conta de personal trainer.
        </p>
      </header>

      <section aria-labelledby="meus-dados-heading" className="space-y-4">
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
          <h2
            id="meus-dados-heading"
            className="text-lg font-semibold text-[--color-text]"
          >
            Meus dados
          </h2>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Nome, e-mail, telefone e CREF.
          </p>
          <div className="mt-4">
            <ContaForm />
          </div>
        </div>
      </section>

      <section aria-labelledby="marca-heading" className="space-y-4">
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
          <h2 id="marca-heading" className="text-lg font-semibold text-[--color-text]">
            Marca (White Label)
          </h2>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Personalize o logo e as cores que seus alunos veem no app.
          </p>
          <div className="mt-4">
            <BrandingForm />
          </div>
        </div>
      </section>

      <section aria-labelledby="alterar-senha-heading" className="space-y-4">
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
          <h2
            id="alterar-senha-heading"
            className="text-lg font-semibold text-[--color-text]"
          >
            Alterar senha
          </h2>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Informe sua senha atual e escolha uma nova senha.
          </p>
          <div className="mt-4">
            <AlterarSenhaForm />
          </div>
        </div>
      </section>
    </div>
  );
}
