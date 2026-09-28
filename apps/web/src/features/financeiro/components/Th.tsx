/** Cabeçalho de coluna compartilhado pelas tabelas do Financeiro. */
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]"
    >
      {children}
    </th>
  );
}
