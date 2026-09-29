import Link from 'next/link';
import { LeadForm } from './LeadForm';

const PILARES = [
  {
    numero: '01',
    titulo: 'Prescrever',
    texto:
      'Monte fichas por treino — séries, repetições, carga e descanso de cada exercício. Salve como modelo e reaplique a outro aluno em segundos, sem montar tudo de novo.',
  },
  {
    numero: '02',
    titulo: 'Executar',
    texto:
      'O aluno treina pelo app mesmo sem sinal — a série fica guardada no aparelho e sincroniza sozinha quando a internet voltar. A cada sessão, a AMFIT sugere o próximo passo, cruzando o histórico de cargas com o esforço percebido que o próprio aluno relata.',
  },
  {
    numero: '03',
    titulo: 'Sua marca',
    texto:
      'Logo, cores e nome do app são seus. O aluno entra por um código de convite e já vê a sua identidade, antes mesmo de digitar a senha.',
  },
  {
    numero: '04',
    titulo: 'Gerenciar',
    texto:
      'Mensalidade por PIX, cartão ou boleto, lembrete automático antes do vencimento e um comparativo do faturamento mês a mês — sem abrir uma planilha.',
  },
] as const;

const FAQ = [
  {
    pergunta: 'Preciso de internet o tempo todo?',
    resposta:
      'Não. O aluno abre o treino do dia e registra as séries mesmo offline; tudo sincroniza sozinho assim que o aparelho reconectar.',
  },
  {
    pergunta: 'Consigo usar a minha própria marca?',
    resposta:
      'Sim. Você define logo, cores e nome do app nas configurações. Seus alunos entram por um código de convite e já veem a sua marca, antes mesmo de fazer login.',
  },
  {
    pergunta: 'Como funciona a cobrança dos meus alunos?',
    resposta:
      'Você configura o valor e o dia de vencimento por aluno. A AMFIT gera a cobrança todo mês, avisa antes do vencimento e reúne tudo em um painel único, com comparativo mês a mês.',
  },
  {
    pergunta: 'O app decide sozinho a carga do próximo treino?',
    resposta:
      'Não — ele sugere. A sugestão combina o histórico de séries do aluno com o esforço percebido que ele relata a cada série, mas o personal sempre pode ajustar antes de confirmar.',
  },
] as const;

/** Largura/gutter compartilhados por toda a página — mudar aqui muda a
 * página inteira de uma vez, em vez de editar a mesma string em cada seção. */
function Container({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`mx-auto max-w-5xl px-6 ${className}`}>{children}</div>;
}

export function LandingPage() {
  return (
    <div className="bg-[--color-bg] text-[--color-text]">
      <TopNav />
      <Hero />
      <Pillars />
      <WhiteLabelSpotlight />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-[--color-border] bg-[--color-bg]/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-4 py-4">
        <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-[--color-primary] shadow-[0_0_0_4px_var(--color-primary-light)]"
          />
          AMFIT
        </span>
        <div className="hidden gap-7 text-sm font-semibold text-[--color-text-muted] sm:flex">
          <a className="hover:text-[--color-text]" href="#funcionalidades">
            Funcionalidades
          </a>
          <a className="hover:text-[--color-text]" href="#marca-propria">
            Sua marca
          </a>
          <a className="hover:text-[--color-text]" href="#duvidas">
            Dúvidas
          </a>
        </div>
        <a
          href="#comecar"
          className="whitespace-nowrap rounded-md bg-[--color-primary] px-5 py-2.5 text-sm font-bold text-white hover:bg-[--color-primary-hover]"
        >
          Comece agora
        </a>
      </Container>
    </nav>
  );
}

function Hero() {
  return (
    <header>
      <Container className="grid gap-14 pb-10 pt-16 sm:grid-cols-[1.05fr_0.95fr] sm:items-center sm:pt-20">
        <div>
          <span className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[--color-primary-hover]">
            <span aria-hidden="true" className="h-px w-5 bg-[--color-primary]" />
            Para personal trainers
          </span>
          <h1 className="text-[2.1rem] font-semibold leading-[1.05] sm:text-5xl">
            O app que carrega <span className="text-[--color-primary-hover]">a sua marca</span>, não a nossa.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg text-[--color-text-muted]">
            Monte fichas, acompanhe a execução de cada aluno e cuide da cobrança da sua consultoria em um só lugar
            — com o seu logo, as suas cores e o nome que você escolher, desde a tela de login.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <a
              href="#comecar"
              className="rounded-md bg-[--color-primary] px-6 py-3 text-sm font-bold text-white hover:bg-[--color-primary-hover]"
            >
              Comece agora
            </a>
            <a
              href="#funcionalidades"
              className="rounded-md border border-[--color-border] px-6 py-3 text-sm font-bold hover:border-[--color-primary-hover] hover:text-[--color-primary-hover]"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-3.5 text-sm text-[--color-text-muted]">
            Feito para personal trainers autônomos e pequenos estúdios no Brasil.
          </p>
        </div>
        <PlayerMock />
      </Container>
    </header>
  );
}

function PlayerMock() {
  return (
    <div className="flex justify-center">
      <div className="w-[280px] max-w-[84vw] -rotate-2 rounded-[34px] border border-[--color-border] bg-[--color-bg] p-3.5 shadow-xl">
        <div className="flex min-h-[400px] flex-col gap-3.5 rounded-[22px] bg-[--color-bg-subtle] px-4 pb-5 pt-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[--color-text-muted]">
            <span>Treino de hoje</span>
            <span className="flex items-center gap-1.5 font-bold text-[--color-success]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[--color-success]" />
              sincronizado
            </span>
          </div>
          <div>
            <p className="font-display text-base font-semibold">Treino A — Peito e tríceps</p>
            <p className="-mt-1 text-xs text-[--color-text-muted]">3 de 5 séries concluídas</p>
          </div>

          <div className="rounded-xl border border-[--color-success] bg-[--color-bg] p-3.5">
            <div className="flex items-baseline justify-between text-sm font-bold">
              <span>Supino reto</span>
              <span
                aria-hidden="true"
                className="ml-auto flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[--color-success] text-xs text-white"
              >
                ✓
              </span>
            </div>
            <p className="text-xs text-[--color-text-muted]">4 séries × 8-10 repetições</p>
            <div className="mt-2.5 flex gap-1.5">
              <MockField label="Carga" value="42,5 kg" />
              <MockField label="Reps" value="10" />
              <MockField label="RPE" value="7" />
            </div>
          </div>

          <div className="rounded-xl border border-[--color-border] bg-[--color-bg] p-3.5">
            <p className="text-sm font-bold">Crucifixo inclinado</p>
            <p className="text-xs text-[--color-text-muted]">3 séries × 10-12 repetições</p>
            <span className="mt-2 inline-block rounded-full bg-[--color-primary-light]/20 px-2 py-1 text-[0.68rem] font-bold text-[--color-primary-hover]">
              ↑ 2,5 kg sugerido
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-md border border-[--color-border] bg-[--color-bg-subtle] px-2 py-1.5">
      <span className="block text-[0.6rem] uppercase tracking-wide text-[--color-text-muted]">{label}</span>
      <b className="text-sm">{value}</b>
    </div>
  );
}

function Pillars() {
  return (
    <section id="funcionalidades">
      <Container className="py-20">
        <div className="max-w-[62ch]">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Tudo o que a rotina de um personal precisa, sem trocar de aplicativo
          </h2>
          <p className="mt-3.5 text-lg text-[--color-text-muted]">
            Da ficha de treino ao boleto do mês, cada parte foi pensada pra funcionar junto — não como quatro
            ferramentas coladas com fita adesiva.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 border-l border-t border-[--color-border] sm:grid-cols-2">
          {PILARES.map((p) => (
            <div key={p.numero} className="border-b border-r border-[--color-border] p-9">
              <div className="font-display text-4xl font-light text-[--color-primary] opacity-60">{p.numero}</div>
              <h3 className="mt-3.5 text-xl font-semibold">{p.titulo}</h3>
              <p className="mt-2.5 max-w-[42ch] text-[--color-text-muted]">{p.texto}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function WhiteLabelSpotlight() {
  return (
    <section id="marca-propria" className="bg-[--color-spotlight-bg] text-[--color-spotlight-fg]">
      <Container className="grid gap-14 py-20 sm:grid-cols-2 sm:items-center">
        <div>
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-[--color-primary-light]">
            White label
          </span>
          <h2 className="font-display text-3xl font-semibold text-[--color-spotlight-fg] sm:text-4xl">
            Seu aluno abre o app e vê a sua consultoria — não a nossa.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[--color-spotlight-muted]">
            Cada personal é um tenant próprio dentro da AMFIT. Você define a marca uma vez; todo aluno convidado
            a partir dali já entra por ela — no app e no portal web.
          </p>
        </div>
        <div className="rounded-2xl border border-[--color-spotlight-line] bg-[--color-spotlight-chip] p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-[--color-spotlight-muted]">
            Código de convite
          </p>
          <p className="mt-2.5 font-mono text-2xl font-semibold tracking-[0.12em] text-[--color-primary-light]">
            K7XT4RPQ
          </p>
          <p className="mt-3.5 break-all font-mono text-sm text-[--color-spotlight-muted]">
            amfit.app/entrar/K7XT4RPQ
          </p>
          <p className="mt-5 border-t border-[--color-spotlight-line] pt-4 text-sm text-[--color-spotlight-muted]">
            Ilustrativo — cada personal recebe o próprio código, gerado automaticamente e regenerável a qualquer
            momento.
          </p>
        </div>
      </Container>
    </section>
  );
}

function Faq() {
  return (
    <section id="duvidas">
      <Container className="py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Perguntas frequentes</h2>
        <div className="mt-10 max-w-[800px]">
          {FAQ.map((item, i) => (
            <details key={item.pergunta} className="border-b border-[--color-border] py-1.5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                {item.pergunta}
                <span aria-hidden="true" className="font-display flex-shrink-0 text-2xl text-[--color-primary-hover]">
                  +
                </span>
              </summary>
              <p className="max-w-[68ch] pb-5 text-[--color-text-muted]">{item.resposta}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="comecar" className="border-y border-[--color-border] bg-[--color-bg-subtle] py-20 text-center">
      <Container>
        <h2 className="font-display mx-auto max-w-[20ch] text-3xl font-semibold sm:text-4xl">
          Sua consultoria, do jeito que você já imagina.
        </h2>
        <p className="mt-4 text-[--color-text-muted]">Deixe seu contato e a gente te avisa assim que o acesso abrir.</p>
        <div className="mt-8">
          <LeadForm />
        </div>
      </Container>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="py-12">
      <Container className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[--color-primary]" />
            AMFIT
          </span>
          <p className="mt-2.5 max-w-[32ch] text-sm text-[--color-text-muted]">
            Plataforma de gestão de treinos para personal trainers, com a marca de cada consultoria.
          </p>
        </div>
        <div className="flex flex-wrap gap-12">
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-[--color-text-muted]">Produto</h4>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a className="hover:text-[--color-primary-hover]" href="#funcionalidades">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a className="hover:text-[--color-primary-hover]" href="#marca-propria">
                  Sua marca
                </a>
              </li>
              <li>
                <a className="hover:text-[--color-primary-hover]" href="#duvidas">
                  Dúvidas
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-[--color-text-muted]">Contato</h4>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a className="hover:text-[--color-primary-hover]" href="#comecar">
                  Fale com a gente
                </a>
              </li>
              <li>
                <Link className="hover:text-[--color-primary-hover]" href="/login">
                  Já tenho conta
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>
      <Container className="mt-10 border-t border-[--color-border] pt-5 text-sm text-[--color-text-muted]">
        © {new Date().getFullYear()} AMFIT. Feito para personal trainers no Brasil.
      </Container>
    </footer>
  );
}
