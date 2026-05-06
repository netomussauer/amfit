type Props = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-[--color-bg-subtle]">
      <aside
        className="hidden w-64 flex-shrink-0 border-r border-[--color-border] bg-[--color-bg] md:block"
        aria-label="Navegação principal"
      >
        <div className="p-6">
          <span className="text-xl font-bold text-[--color-primary]">AMFIT</span>
        </div>
        <nav className="px-4">
          <ul className="space-y-1">
            <li>
              <a
                href="/dashboard"
                className="block rounded-md px-3 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="/alunos"
                className="block rounded-md px-3 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
              >
                Alunos
              </a>
            </li>
            <li>
              <a
                href="/exercicios"
                className="block rounded-md px-3 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
              >
                Exercícios
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <main id="main-content" className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
