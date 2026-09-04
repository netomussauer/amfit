'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/alunos', label: 'Alunos' },
  { href: '/exercicios', label: 'Exercícios' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/configuracoes', label: 'Configurações' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-64 flex-shrink-0 border-r border-[--color-border] bg-[--color-bg] md:block"
      aria-label="Navegação principal"
    >
      <div className="px-6 py-6">
        <Link
          href="/dashboard"
          className="text-xl font-bold text-[--color-primary]"
        >
          AMFIT
        </Link>
      </div>
      <nav className="px-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[--color-bg-muted] text-[--color-primary]'
                      : 'text-[--color-text] hover:bg-[--color-bg-muted]',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
