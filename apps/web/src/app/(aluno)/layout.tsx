import { AlunoSidebar } from '@/shared/components/layout/AlunoSidebar';
import { Header } from '@/shared/components/layout/Header';

type Props = {
  children: React.ReactNode;
};

export default function AlunoLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-[--color-bg-subtle]">
      <AlunoSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main-content" className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
