'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, type CurrentUser } from '@/shared/lib/auth';
import { useLogout } from '@/features/auth/hooks/useLogout';

export function Header() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logout = useLogout();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-[--color-border] bg-[--color-bg] px-6 py-4">
      <div className="text-sm text-[--color-text-muted]">
        {user ? (
          <span>
            Olá, <span className="font-medium text-[--color-text]">{user.nome}</span>
          </span>
        ) : (
          <span aria-hidden="true">&nbsp;</span>
        )}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-busy={isLoggingOut}
        className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoggingOut ? 'Saindo...' : 'Sair'}
      </button>
    </header>
  );
}
